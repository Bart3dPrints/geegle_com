-- 0009: chat corrections — forward references, pins, moderation, locking.
--
-- Run 4.1 corrective migration. 0007 and 0008 are already deployed; this file
-- adds to them and never rewrites their history.
--
-- 1. Forwarded messages no longer carry a copy of the original text. A forward
--    stores only the root message id; the reader's own permissions decide
--    whether the text is resolved at read time, so an edit propagates, an
--    unsend empties it, and revoked access (removed from a group, deleted for
--    me) withholds it. Existing copied bodies are purged.
-- 2. Personal conversation pins (public chat stays first by rule, not by data).
-- 3. Moderation: moderator grants, public-message removal, temporary public
--    mute, report resolution and an audit trail. Private conversations are not
--    opened to moderators.
-- 4. Concurrency: an atomic rate-limit function, row locks around message
--    mutation, locks around forwarding, and triggers that make a friendship or
--    request impossible while either side blocks the other.

-- ---------------------------------------------------------------------------
-- Concurrency helpers
-- ---------------------------------------------------------------------------

-- The previous implementation counted and then inserted, so two simultaneous
-- requests could both pass the limit. This version serialises on a
-- transaction-scoped advisory lock per (account, action) and counts inside it.
create or replace function public.geegle_rate_limit(p_action text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_action, 0));

  select count(*) into v_count
  from public.geegle_social_rate
  where user_id = v_uid and action = p_action and at > now() - p_window;

  if v_count >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.geegle_social_rate (user_id, action) values (v_uid, p_action);

  delete from public.geegle_social_rate where at < now() - interval '1 day';
end;
$$;

-- A friendship can never exist while either account blocks the other, whatever
-- order the two transactions happen to commit in.
create or replace function public.geegle_tg_friendship_requires_no_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.geegle_is_blocked(new.user_low, new.user_high) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists geegle_friendship_no_block on public.geegle_friendships;
create trigger geegle_friendship_no_block
  before insert or update on public.geegle_friendships
  for each row execute function public.geegle_tg_friendship_requires_no_block();

-- The same guard for a pending request.
create or replace function public.geegle_tg_request_requires_no_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and public.geegle_is_blocked(new.sender_id, new.recipient_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists geegle_request_no_block on public.geegle_friend_requests;
create trigger geegle_request_no_block
  before insert or update on public.geegle_friend_requests
  for each row execute function public.geegle_tg_request_requires_no_block();

alter table public.geegle_messages
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_reason text;

-- A forwarded or moderated message legitimately holds no text of its own, so
-- the original constraint (text required) no longer describes the row shape.
-- The old constraint is dropped first, because purging the copied text below
-- would otherwise violate it.
alter table public.geegle_messages drop constraint if exists geegle_messages_body;

-- Existing forwards were written with a copy of the original text. Remove the
-- copies; their previews now resolve from the root row like every other
-- forward. Ordinary messages (forwarded_from is null) are untouched.
update public.geegle_messages
  set body = ''
  where forwarded_from is not null
    and body <> '';
alter table public.geegle_messages add constraint geegle_messages_body check (
  (unsent_at is not null and body = '')
  or (moderated_at is not null and body = '')
  or (forwarded_from is not null and body = '')
  or (unsent_at is null
      and moderated_at is null
      and forwarded_from is null
      and char_length(btrim(body)) between 1 and 4000)
);

-- ---------------------------------------------------------------------------
-- Pins
-- ---------------------------------------------------------------------------

create table if not exists public.geegle_conversation_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.geegle_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
create index if not exists geegle_conversation_pins_user_idx
  on public.geegle_conversation_pins (user_id, created_at desc);

alter table public.geegle_conversation_pins enable row level security;
drop policy if exists geegle_conversation_pins_select_own on public.geegle_conversation_pins;
create policy geegle_conversation_pins_select_own on public.geegle_conversation_pins
  for select using ((select auth.uid()) = user_id);

revoke all on public.geegle_conversation_pins from anon, authenticated;
grant select on public.geegle_conversation_pins to authenticated;

create or replace function public.geegle_chat_set_pinned(p_conversation uuid, p_pinned boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_kind text;
begin
  select kind into v_kind from public.geegle_conversations where id = p_conversation;
  if v_kind is null or not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  -- The public room is always first by rule; pinning it would be meaningless.
  if v_kind = 'public' then
    raise exception 'not_pinnable' using errcode = 'P0001';
  end if;

  if coalesce(p_pinned, false) then
    insert into public.geegle_conversation_pins (user_id, conversation_id)
      values (v_uid, p_conversation)
      on conflict (user_id, conversation_id) do nothing;
  else
    delete from public.geegle_conversation_pins
      where user_id = v_uid and conversation_id = p_conversation;
  end if;

  return jsonb_build_object('pinned', coalesce(p_pinned, false));
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversation list: public first, then pinned, then recent activity.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_public uuid;
begin
  select id into v_public from public.geegle_conversations where kind = 'public' limit 1;
  if v_public is not null then
    insert into public.geegle_conversation_members (conversation_id, user_id)
      values (v_public, v_uid)
      on conflict (conversation_id, user_id) do nothing;
  end if;

  return coalesce((
    select jsonb_agg(entry order by is_public desc, is_pinned desc, activity desc, title_sort asc)
    from (
      select
        jsonb_build_object(
          'id', c.id,
          'kind', c.kind,
          'title', case
                     when c.kind = 'group' then c.title
                     when c.kind = 'dm' then coalesce(other.username, 'Direct message')
                     else 'Public chat'
                   end,
          'otherUserId', case when c.kind = 'dm' then other.id end,
          'role', m.role,
          'pinned', pin.user_id is not null,
          'memberCount', (
            select count(*) from public.geegle_conversation_members mm
            where mm.conversation_id = c.id
          ),
          'lastActivityAt', coalesce(last.created_at, c.created_at),
          'lastMessage', case when last.id is null then null else jsonb_build_object(
            'id', last.id,
            'authorName', coalesce(last_author.username, 'Deleted account'),
            'body', case
                      when last.unsent_at is not null or last.moderated_at is not null then null
                      when last.forwarded_from is not null then null
                      else left(last.body, 140)
                    end,
            'forwarded', last.forwarded_from is not null,
            'unsent', last.unsent_at is not null,
            'createdAt', last.created_at,
            'mine', last.author_id is not distinct from v_uid
          ) end,
          'unread', (
            select count(*) from public.geegle_messages um
            where um.conversation_id = c.id
              and um.created_at > coalesce(m.last_read_at, m.joined_at)
              and um.author_id is distinct from v_uid
              and um.unsent_at is null
              and um.moderated_at is null
              and not exists (
                select 1 from public.geegle_message_hidden h
                where h.message_id = um.id and h.user_id = v_uid
              )
          )
        ) as entry,
        (c.kind = 'public') as is_public,
        (pin.user_id is not null) as is_pinned,
        coalesce(last.created_at, c.created_at) as activity,
        lower(coalesce(c.title, other.username, 'public chat')) as title_sort
      from public.geegle_conversations c
      join public.geegle_conversation_members m
        on m.conversation_id = c.id and m.user_id = v_uid
      left join public.geegle_conversation_pins pin
        on pin.conversation_id = c.id and pin.user_id = v_uid
      left join lateral (
        select p.id, p.username
        from public.geegle_conversation_members om
        join public.geegle_profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> v_uid
        order by om.joined_at
        limit 1
      ) other on c.kind = 'dm'
      left join lateral (
        select msg.id, msg.author_id, msg.body, msg.created_at, msg.unsent_at,
               msg.moderated_at, msg.forwarded_from
        from public.geegle_messages msg
        where msg.conversation_id = c.id
          and not exists (
            select 1 from public.geegle_message_hidden h
            where h.message_id = msg.id and h.user_id = v_uid
          )
        order by msg.created_at desc, msg.id desc
        limit 1
      ) last on true
      left join public.geegle_profiles last_author on last_author.id = last.author_id
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages: forwarded text is resolved for the reader, never stored.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_messages(
  p_conversation uuid,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(entry order by created_at desc, id desc)
    from (
      select
        msg.created_at,
        msg.id,
        jsonb_build_object(
          'id', msg.id,
          'conversationId', msg.conversation_id,
          -- A forwarded row stores no text of its own: the words come from the
          -- root message, and only while this reader may still see them.
          'body', case
                    when msg.unsent_at is not null or msg.moderated_at is not null then null
                    when msg.forwarded_from is null then msg.body
                    when root.id is not null
                      and root.unsent_at is null
                      and root.moderated_at is null
                      and public.geegle_can_read(root.conversation_id)
                      and not exists (
                        select 1 from public.geegle_message_hidden h
                        where h.message_id = root.id and h.user_id = v_uid
                      )
                    then root.body
                    else null
                  end,
          'createdAt', msg.created_at,
          'editedAt', msg.edited_at,
          'unsent', msg.unsent_at is not null,
          'moderated', msg.moderated_at is not null,
          'authorId', msg.author_id,
          'authorName', coalesce(author.username, 'Deleted account'),
          'mine', msg.author_id is not distinct from v_uid,
          'forwarded', case when msg.forwarded_from is null then null else jsonb_build_object(
            'messageId', msg.forwarded_from,
            'conversationId', root.conversation_id,
            'authorName', coalesce(root_author.username, 'Deleted account'),
            'createdAt', root.created_at,
            'available', root.id is not null
              and root.unsent_at is null
              and root.moderated_at is null
              and public.geegle_can_read(root.conversation_id)
              and not exists (
                select 1 from public.geegle_message_hidden h
                where h.message_id = root.id and h.user_id = v_uid
              )
          ) end
        ) as entry
      from public.geegle_messages msg
      left join public.geegle_profiles author on author.id = msg.author_id
      left join lateral (
        select r.id, r.conversation_id, r.created_at, r.unsent_at, r.moderated_at,
               r.author_id, r.body
        from public.geegle_messages r
        where r.id = msg.forwarded_from
      ) root on true
      left join public.geegle_profiles root_author on root_author.id = root.author_id
      where msg.conversation_id = p_conversation
        and not exists (
          select 1 from public.geegle_message_hidden h
          where h.message_id = msg.id and h.user_id = v_uid
        )
        and (
          p_before is null
          or (msg.created_at, msg.id) < (
            p_before,
            coalesce(p_before_id, '00000000-0000-0000-0000-000000000000'::uuid)
          )
        )
      order by msg.created_at desc, msg.id desc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sending: public chat can be muted; the conversation row is locked so two
-- sends cannot interleave their read-state writes.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_send(p_conversation uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_kind text;
  v_id uuid;
  v_muted timestamptz;
begin
  select kind into v_kind from public.geegle_conversations where id = p_conversation;
  if v_kind is null or not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'message_empty' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  if v_kind = 'public' then
    select until into v_muted from public.geegle_chat_mutes where user_id = v_uid;
    if v_muted is not null and v_muted > now() then
      raise exception 'muted' using errcode = 'P0001';
    end if;
  end if;

  perform public.geegle_rate_limit('chat_message', 40, interval '1 minute');

  perform 1 from public.geegle_conversations where id = p_conversation for update;

  insert into public.geegle_messages (conversation_id, author_id, body)
    values (p_conversation, v_uid, v_body)
    returning id into v_id;

  update public.geegle_conversations set updated_at = now() where id = p_conversation;
  insert into public.geegle_conversation_members (conversation_id, user_id, last_read_at)
    values (p_conversation, v_uid, now())
    on conflict (conversation_id, user_id) do update set last_read_at = now();

  return jsonb_build_object('messageId', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Editing: forwards are not editable (their body is not their author's words),
-- and the row is locked so an edit and an unsend cannot both win.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_edit(p_message uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_msg public.geegle_messages%rowtype;
begin
  select * into v_msg from public.geegle_messages where id = p_message for update;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'not_author' using errcode = 'P0001';
  end if;
  if v_msg.unsent_at is not null then
    raise exception 'message_unsent' using errcode = 'P0001';
  end if;
  if v_msg.forwarded_from is not null then
    raise exception 'forward_not_editable' using errcode = 'P0001';
  end if;
  if not public.geegle_can_read(v_msg.conversation_id) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'message_empty' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('chat_edit', 30, interval '10 minutes');

  update public.geegle_messages
    set body = v_body, edited_at = now()
    where id = p_message;

  return jsonb_build_object('status', 'edited');
end;
$$;

create or replace function public.geegle_chat_unsend(p_message uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_msg public.geegle_messages%rowtype;
begin
  select * into v_msg from public.geegle_messages where id = p_message for update;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'not_author' using errcode = 'P0001';
  end if;
  if v_msg.unsent_at is not null then
    return jsonb_build_object('status', 'unsent');
  end if;

  -- The text is destroyed, not merely hidden: every forward of this row
  -- resolves through this record and becomes unavailable with it.
  update public.geegle_messages
    set body = '', unsent_at = now(), edited_at = null
    where id = p_message;

  return jsonb_build_object('status', 'unsent');
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading state: idempotent. An update is only written when the timestamp
-- actually advances, so marking as read cannot trigger a Realtime loop.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_mark_read(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_latest timestamptz;
  v_current timestamptz;
begin
  if not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  insert into public.geegle_conversation_members (conversation_id, user_id)
    values (p_conversation, v_uid)
    on conflict (conversation_id, user_id) do nothing;

  select last_read_at into v_current
  from public.geegle_conversation_members
  where conversation_id = p_conversation and user_id = v_uid
  for update;

  select max(m.created_at) into v_latest
  from public.geegle_messages m
  where m.conversation_id = p_conversation
    and m.author_id is distinct from v_uid;

  if v_latest is not null and (v_current is null or v_latest > v_current) then
    update public.geegle_conversation_members
      set last_read_at = v_latest
      where conversation_id = p_conversation and user_id = v_uid;
  end if;

  return jsonb_build_object('status', 'read');
end;
$$;

-- ---------------------------------------------------------------------------
-- Forwarding: store the reference, not the words.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_forward(p_message uuid, p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_msg public.geegle_messages%rowtype;
  v_source public.geegle_conversations%rowtype;
  v_target public.geegle_conversations%rowtype;
  v_root uuid;
  v_other uuid;
  v_id uuid;
begin
  select * into v_msg from public.geegle_messages where id = p_message;
  if not found or v_msg.unsent_at is not null or v_msg.moderated_at is not null then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;

  select * into v_source
  from public.geegle_conversations where id = v_msg.conversation_id;
  if v_source.id is null or not public.geegle_can_read(v_source.id) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_source.kind = 'dm' then
    raise exception 'forward_not_allowed' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.geegle_conversations where id = p_conversation;
  if v_target.id is null then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if v_target.kind <> 'dm' then
    raise exception 'forward_not_allowed' using errcode = 'P0001';
  end if;
  if not public.geegle_can_read(v_target.id) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  v_other := case when v_target.dm_low = v_uid then v_target.dm_high else v_target.dm_low end;
  v_root := coalesce(v_msg.forwarded_from, v_msg.id);

  -- Lock the root row: an unsend that commits before this point is seen by the
  -- check below, one that commits after it invalidates the preview instead.
  perform 1 from public.geegle_messages where id = v_root for share;
  select * into v_msg from public.geegle_messages where id = v_root;
  if not found or v_msg.unsent_at is not null or v_msg.moderated_at is not null then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.geegle_friendships
    where user_low = least(v_uid, v_other)
      and user_high = greatest(v_uid, v_other)
      and removed_at is null
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;

  if v_source.kind = 'group' then
    -- Membership is checked under a lock so a removal cannot land between the
    -- check and the insert.
    perform 1 from public.geegle_conversation_members
      where conversation_id = v_source.id and user_id = v_other
      for share;
    if not found then
      raise exception 'forward_not_allowed' using errcode = 'P0001';
    end if;
  end if;

  perform public.geegle_rate_limit('chat_forward', 30, interval '1 minute');

  insert into public.geegle_messages (conversation_id, author_id, body, forwarded_from)
    values (p_conversation, v_uid, '', v_root)
    returning id into v_id;

  update public.geegle_conversations set updated_at = now() where id = p_conversation;
  insert into public.geegle_conversation_members (conversation_id, user_id, last_read_at)
    values (p_conversation, v_uid, now())
    on conflict (conversation_id, user_id) do update set last_read_at = now();

  return jsonb_build_object('messageId', v_id);
end;
$$;

-- Existing forwards were written with a copy of the original text. Remove the
-- copies; their previews now resolve from the root row like every other
-- forward. Ordinary messages (forwarded_from is null) are untouched.
update public.geegle_messages
  set body = ''
  where forwarded_from is not null
    and body <> '';

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

alter table public.geegle_message_reports
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution text;

create index if not exists geegle_message_reports_open_idx
  on public.geegle_message_reports (created_at desc)
  where resolved_at is null;

-- Who may moderate. Written only by the database owner (service role); there
-- is no client path to grant, and no default account.
create table if not exists public.geegle_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.geegle_chat_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.geegle_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('remove_message', 'mute', 'resolve_report', 'dismiss_report')),
  target_user uuid references auth.users(id) on delete set null,
  target_message uuid,
  report_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists geegle_moderation_actions_created_idx
  on public.geegle_moderation_actions (created_at desc);

alter table public.geegle_moderators enable row level security;
alter table public.geegle_chat_mutes enable row level security;
alter table public.geegle_moderation_actions enable row level security;

drop policy if exists geegle_moderators_select_own on public.geegle_moderators;
create policy geegle_moderators_select_own on public.geegle_moderators
  for select using ((select auth.uid()) = user_id);

drop policy if exists geegle_chat_mutes_select_own on public.geegle_chat_mutes;
create policy geegle_chat_mutes_select_own on public.geegle_chat_mutes
  for select using ((select auth.uid()) = user_id);

-- Audit rows are readable only through the moderator function below.
drop policy if exists geegle_moderation_actions_none on public.geegle_moderation_actions;

revoke all on public.geegle_moderators from anon, authenticated;
revoke all on public.geegle_chat_mutes from anon, authenticated;
revoke all on public.geegle_moderation_actions from anon, authenticated;
grant select on public.geegle_moderators to authenticated;
grant select on public.geegle_chat_mutes to authenticated;

create or replace function public.geegle_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.geegle_moderators where user_id = auth.uid()
  );
$$;

create or replace function public.geegle_require_moderator()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if not public.geegle_is_moderator() then
    raise exception 'not_moderator' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- The review queue. Public reports include the reported text, because public
-- messages are visible to every signed-in account anyway. Private reports
-- return only what is needed to act on the report itself: never the body of a
-- private message and never a background picture.
create or replace function public.geegle_mod_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_moderator();
begin
  return coalesce((
    select jsonb_agg(entry order by created_at asc)
    from (
      select
        r.created_at,
        jsonb_build_object(
          'reportId', r.id,
          'reason', r.reason,
          'createdAt', r.created_at,
          'reporter', coalesce(reporter.username, 'Deleted account'),
          'kind', c.kind,
          'conversationTitle', case
            when c.kind = 'public' then 'Public chat'
            when c.kind = 'group' then c.title
            else 'Direct message'
          end,
          'messageId', m.id,
          'authorName', coalesce(author.username, 'Deleted account'),
          'authorId', case when c.kind = 'public' then m.author_id end,
          'body', case when c.kind = 'public' and m.unsent_at is null and m.moderated_at is null
                       then left(m.body, 2000) end,
          'alreadyRemoved', m.moderated_at is not null or m.unsent_at is not null
        ) as entry
      from public.geegle_message_reports r
      join public.geegle_messages m on m.id = r.message_id
      join public.geegle_conversations c on c.id = m.conversation_id
      left join public.geegle_profiles reporter on reporter.id = r.reporter_id
      left join public.geegle_profiles author on author.id = m.author_id
      where r.resolved_at is null
      order by r.created_at asc
      limit 100
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.geegle_mod_remove_message(
  p_message uuid,
  p_reason text,
  p_report uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_moderator();
  v_kind text;
  v_author uuid;
  v_reason text := left(btrim(coalesce(p_reason, '')), 500);
begin
  if char_length(v_reason) < 1 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select c.kind, m.author_id into v_kind, v_author
  from public.geegle_messages m
  join public.geegle_conversations c on c.id = m.conversation_id
  where m.id = p_message
  for update of m;

  if v_kind is null then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  -- Moderators act on the public room only. Private conversations are not
  -- opened to them; a private report is answered by the report workflow alone.
  if v_kind <> 'public' then
    raise exception 'not_public' using errcode = 'P0001';
  end if;

  update public.geegle_messages
    set body = '', moderated_at = now(), moderated_by = v_uid, moderation_reason = v_reason
    where id = p_message;

  insert into public.geegle_moderation_actions
    (moderator_id, action, target_user, target_message, report_id, reason)
    values (v_uid, 'remove_message', v_author, p_message, p_report, v_reason);

  if p_report is not null then
    update public.geegle_message_reports
      set resolved_at = now(), resolved_by = v_uid, resolution = 'removed'
      where id = p_report and resolved_at is null;
  end if;

  return jsonb_build_object('status', 'removed');
end;
$$;

create or replace function public.geegle_mod_mute(
  p_user uuid,
  p_minutes integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_moderator();
  v_minutes int := least(greatest(coalesce(p_minutes, 60), 1), 60 * 24 * 30);
  v_reason text := left(btrim(coalesce(p_reason, '')), 500);
  v_until timestamptz;
begin
  if p_user is null then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  -- Moderating oneself is never useful and hides a mis-granted privilege.
  if p_user = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  v_until := now() + make_interval(mins => v_minutes);

  insert into public.geegle_chat_mutes (user_id, until, reason, created_by)
    values (p_user, v_until, nullif(v_reason, ''), v_uid)
    on conflict (user_id) do update
      set until = greatest(public.geegle_chat_mutes.until, excluded.until),
          reason = excluded.reason,
          created_by = excluded.created_by;

  insert into public.geegle_moderation_actions
    (moderator_id, action, target_user, reason)
    values (v_uid, 'mute', p_user, v_reason);

  return jsonb_build_object('until', v_until);
end;
$$;

create or replace function public.geegle_mod_resolve_report(p_report uuid, p_resolution text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_moderator();
  v_resolution text := case when p_resolution = 'removed' then 'removed' else 'dismissed' end;
begin
  update public.geegle_message_reports
    set resolved_at = now(), resolved_by = v_uid, resolution = v_resolution
    where id = p_report and resolved_at is null;

  if not found then
    raise exception 'report_not_found' using errcode = 'P0001';
  end if;

  insert into public.geegle_moderation_actions (moderator_id, action, report_id, reason)
    values (
      v_uid,
      case when v_resolution = 'removed' then 'resolve_report' else 'dismiss_report' end,
      p_report,
      v_resolution
    );

  return jsonb_build_object('status', v_resolution);
end;
$$;

create or replace function public.geegle_mod_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_moderator();
begin
  return coalesce((
    select jsonb_agg(entry order by created_at desc)
    from (
      select jsonb_build_object(
        'id', a.id,
        'action', a.action,
        'moderator', coalesce(mp.username, 'Deleted account'),
        'targetUser', tp.username,
        'targetMessage', a.target_message,
        'reportId', a.report_id,
        'reason', a.reason,
        'createdAt', a.created_at
      ) as entry, a.created_at
      from public.geegle_moderation_actions a
      left join public.geegle_profiles mp on mp.id = a.moderator_id
      left join public.geegle_profiles tp on tp.id = a.target_user
      order by a.created_at desc
      limit 50
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Moderator access to their own tools only.
revoke execute on function public.geegle_is_moderator() from public, anon;
revoke execute on function public.geegle_mod_queue() from public, anon;
revoke execute on function public.geegle_mod_remove_message(uuid, text, uuid) from public, anon;
revoke execute on function public.geegle_mod_mute(uuid, integer, text) from public, anon;
revoke execute on function public.geegle_mod_resolve_report(uuid, text) from public, anon;
revoke execute on function public.geegle_mod_history() from public, anon;
revoke execute on function public.geegle_chat_set_pinned(uuid, boolean) from public, anon;

grant execute on function public.geegle_is_moderator() to authenticated;
grant execute on function public.geegle_mod_queue() to authenticated;
grant execute on function public.geegle_mod_remove_message(uuid, text, uuid) to authenticated;
grant execute on function public.geegle_mod_mute(uuid, integer, text) to authenticated;
grant execute on function public.geegle_mod_resolve_report(uuid, text) to authenticated;
grant execute on function public.geegle_mod_history() to authenticated;
grant execute on function public.geegle_chat_set_pinned(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: pins are personal, so no publication entry is needed. Mutes are
-- checked when sending, not pushed to clients.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.geegle_conversation_pins;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Post-check: the corrective guarantees this migration exists for.
-- ---------------------------------------------------------------------------

do $$
declare
  v_body text;
begin
  select prosrc into v_body from pg_proc where proname = 'geegle_chat_forward';
  if v_body like '%v_msg.body,%' then
    raise exception '0009 post-check: forward still copies the message body';
  end if;

  if exists (
    select 1 from public.geegle_messages
    where forwarded_from is not null and body <> ''
  ) then
    raise exception '0009 post-check: forwarded rows still carry copied text';
  end if;

  if has_function_privilege('anon', 'public.geegle_mod_queue()', 'EXECUTE') then
    raise exception '0009 post-check: anonymous moderation access';
  end if;
end;
$$;

notify pgrst, 'reload schema';
