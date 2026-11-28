-- 0008: chat — public room, direct messages, groups, forwarding, personal
-- message visibility, read state and per-conversation DM backgrounds.
--
-- Design notes
-- ------------
-- Everything is Geegle-prefixed in `public`, so the other application that
-- shares this project is untouched.
--
-- As in 0007, clients get SELECT only. Every mutation is a security-definer
-- function that derives the caller from auth.uid(); no function accepts an
-- "acting user". A message row is never deleted by a user: "unsend" clears the
-- body and records the time, and "delete for me" writes a private hidden row,
-- so a forwarded reference stays stable and can be reported as unavailable.
--
-- A DM is readable only while the friendship is active and neither account has
-- blocked the other; a group is readable by its current members; the public
-- room is readable by any signed-in account. All three use the same helper, so
-- a client cannot widen its own access.

create table if not exists public.geegle_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('public', 'dm', 'group')),
  title text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dm_low uuid references auth.users(id) on delete cascade,
  dm_high uuid references auth.users(id) on delete cascade,
  constraint geegle_conversations_title check (
    (kind = 'group' and title is not null
      and char_length(btrim(title)) between 1 and 60)
    or (kind <> 'group' and title is null)
  ),
  constraint geegle_conversations_dm_pair check (
    (kind = 'dm' and dm_low is not null and dm_high is not null and dm_low < dm_high)
    or (kind <> 'dm' and dm_low is null and dm_high is null)
  )
);

-- One row per pair: a DM cannot be duplicated.
create unique index if not exists geegle_conversations_dm_pair_idx
  on public.geegle_conversations (dm_low, dm_high) where kind = 'dm';
-- Exactly one public room.
create unique index if not exists geegle_conversations_public_idx
  on public.geegle_conversations (kind) where kind = 'public';

insert into public.geegle_conversations (kind)
  select 'public'
  where not exists (select 1 from public.geegle_conversations where kind = 'public');

create table if not exists public.geegle_conversation_members (
  conversation_id uuid not null references public.geegle_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists geegle_conversation_members_user_idx
  on public.geegle_conversation_members (user_id);

create table if not exists public.geegle_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.geegle_conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unsent_at timestamptz,
  forwarded_from uuid references public.geegle_messages(id) on delete set null,
  constraint geegle_messages_body check (
    (unsent_at is not null and body = '')
    or (unsent_at is null and char_length(btrim(body)) between 1 and 4000)
  )
);
create index if not exists geegle_messages_conversation_idx
  on public.geegle_messages (conversation_id, created_at desc, id desc);
create index if not exists geegle_messages_forwarded_idx
  on public.geegle_messages (forwarded_from);

create table if not exists public.geegle_message_hidden (
  message_id uuid not null references public.geegle_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.geegle_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.geegle_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists geegle_message_reports_message_idx
  on public.geegle_message_reports (message_id, created_at desc);

-- Per-account background for one DM. Never shared, never in a public bucket.
create table if not exists public.geegle_dm_backgrounds (
  conversation_id uuid not null references public.geegle_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'default' check (kind in ('default', 'solid', 'color', 'image')),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  image_path text check (image_path is null or char_length(image_path) between 1 and 200),
  overlay smallint not null default 40 check (overlay between 0 and 90),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  constraint geegle_dm_backgrounds_shape check (
    (kind = 'default' and color is null and image_path is null)
    or (kind in ('solid', 'color') and color is not null and image_path is null)
    or (kind = 'image' and image_path is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Access helpers. Every one derives the viewer from auth.uid(), never from an
-- argument, so exposing EXECUTE cannot reveal another account's access.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_can_read(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.geegle_conversations c
    where c.id = p_conversation
      and (
        c.kind = 'public'
        or exists (
          select 1 from public.geegle_conversation_members m
          where m.conversation_id = c.id and m.user_id = (select auth.uid())
        )
      )
      and (
        c.kind <> 'dm'
        or (
          exists (
            select 1 from public.geegle_friendships f
            where f.user_low = c.dm_low
              and f.user_high = c.dm_high
              and f.removed_at is null
          )
          and not public.geegle_is_blocked(c.dm_low, c.dm_high)
        )
      )
  );
$$;

create or replace function public.geegle_is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.geegle_conversation_members m
    where m.conversation_id = p_conversation
      and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.geegle_conversations enable row level security;
alter table public.geegle_conversation_members enable row level security;
alter table public.geegle_messages enable row level security;
alter table public.geegle_message_hidden enable row level security;
alter table public.geegle_message_reports enable row level security;
alter table public.geegle_dm_backgrounds enable row level security;

drop policy if exists geegle_conversations_select_readable on public.geegle_conversations;
create policy geegle_conversations_select_readable on public.geegle_conversations
  for select using (kind = 'public' or public.geegle_can_read(id));

drop policy if exists geegle_members_select_own_rooms on public.geegle_conversation_members;
create policy geegle_members_select_own_rooms on public.geegle_conversation_members
  for select using (public.geegle_is_conversation_member(conversation_id));

drop policy if exists geegle_messages_select_readable on public.geegle_messages;
create policy geegle_messages_select_readable on public.geegle_messages
  for select using (public.geegle_can_read(conversation_id));

drop policy if exists geegle_message_hidden_select_own on public.geegle_message_hidden;
create policy geegle_message_hidden_select_own on public.geegle_message_hidden
  for select using ((select auth.uid()) = user_id);

drop policy if exists geegle_message_reports_select_own on public.geegle_message_reports;
create policy geegle_message_reports_select_own on public.geegle_message_reports
  for select using ((select auth.uid()) = reporter_id);

drop policy if exists geegle_dm_backgrounds_select_own on public.geegle_dm_backgrounds;
create policy geegle_dm_backgrounds_select_own on public.geegle_dm_backgrounds
  for select using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Grants: read-only for clients; every write path is a function.
-- ---------------------------------------------------------------------------

revoke all on public.geegle_conversations from anon, authenticated;
revoke all on public.geegle_conversation_members from anon, authenticated;
revoke all on public.geegle_messages from anon, authenticated;
revoke all on public.geegle_message_hidden from anon, authenticated;
revoke all on public.geegle_message_reports from anon, authenticated;
revoke all on public.geegle_dm_backgrounds from anon, authenticated;

grant select on public.geegle_conversations to authenticated;
grant select on public.geegle_conversation_members to authenticated;
grant select on public.geegle_messages to authenticated;
grant select on public.geegle_dm_backgrounds to authenticated;

revoke execute on function public.geegle_can_read(uuid) from public, anon;
grant execute on function public.geegle_can_read(uuid) to authenticated;
revoke execute on function public.geegle_is_conversation_member(uuid) from public, anon;
grant execute on function public.geegle_is_conversation_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One read for the whole conversation list
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
  -- Joining the public room is implicit: the first read records membership so
  -- read state and unread counts have somewhere to live.
  select id into v_public from public.geegle_conversations where kind = 'public' limit 1;
  if v_public is not null then
    insert into public.geegle_conversation_members (conversation_id, user_id)
      values (v_public, v_uid)
      on conflict (conversation_id, user_id) do nothing;
  end if;

  return coalesce((
    select jsonb_agg(entry order by activity desc, title_sort asc)
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
          'memberCount', (
            select count(*) from public.geegle_conversation_members mm
            where mm.conversation_id = c.id
          ),
          'lastActivityAt', coalesce(last.created_at, c.created_at),
          'lastMessage', case when last.id is null then null else jsonb_build_object(
            'id', last.id,
            'authorName', coalesce(last_author.username, 'Deleted account'),
            'body', case when last.unsent_at is not null then null else left(last.body, 140) end,
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
              and not exists (
                select 1 from public.geegle_message_hidden h
                where h.message_id = um.id and h.user_id = v_uid
              )
          )
        ) as entry,
        coalesce(last.created_at, c.created_at) as activity,
        lower(coalesce(c.title, other.username, 'public chat')) as title_sort
      from public.geegle_conversations c
      join public.geegle_conversation_members m
        on m.conversation_id = c.id and m.user_id = v_uid
      left join lateral (
        select p.id, p.username
        from public.geegle_conversation_members om
        join public.geegle_profiles p on p.id = om.user_id
        where om.conversation_id = c.id and om.user_id <> v_uid
        order by om.joined_at
        limit 1
      ) other on c.kind = 'dm'
      left join lateral (
        select msg.id, msg.author_id, msg.body, msg.created_at, msg.unsent_at
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
-- Conversations
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_open_dm(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_id uuid;
begin
  if p_other is null or p_other = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_friendships
    where user_low = least(v_uid, p_other)
      and user_high = greatest(v_uid, p_other)
      and removed_at is null
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;
  if public.geegle_is_blocked(v_uid, p_other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  select id into v_id
  from public.geegle_conversations
  where kind = 'dm'
    and dm_low = least(v_uid, p_other)
    and dm_high = greatest(v_uid, p_other);

  if v_id is null then
    insert into public.geegle_conversations (kind, dm_low, dm_high, created_by)
      values ('dm', least(v_uid, p_other), greatest(v_uid, p_other), v_uid)
      returning id into v_id;
  end if;

  insert into public.geegle_conversation_members (conversation_id, user_id)
    values (v_id, v_uid) on conflict do nothing;
  insert into public.geegle_conversation_members (conversation_id, user_id)
    values (v_id, p_other) on conflict do nothing;

  return jsonb_build_object('conversationId', v_id);
end;
$$;

create or replace function public.geegle_chat_create_group(p_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
begin
  if char_length(v_title) < 1 then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if char_length(v_title) > 60 then
    raise exception 'title_too_long' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('group_create', 5, interval '1 hour');

  insert into public.geegle_conversations (kind, title, created_by)
    values ('group', v_title, v_uid)
    returning id into v_id;

  insert into public.geegle_conversation_members (conversation_id, user_id, role)
    values (v_id, v_uid, 'owner');

  return jsonb_build_object('conversationId', v_id);
end;
$$;

create or replace function public.geegle_chat_rename_group(p_conversation uuid, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) < 1 then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if char_length(v_title) > 60 then
    raise exception 'title_too_long' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_conversation_members
    where conversation_id = p_conversation and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'owner_only' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_conversations
    where id = p_conversation and kind = 'group'
  ) then
    raise exception 'not_a_group' using errcode = 'P0001';
  end if;

  update public.geegle_conversations
    set title = v_title, updated_at = now()
    where id = p_conversation;

  return jsonb_build_object('status', 'renamed');
end;
$$;

create or replace function public.geegle_chat_invite(p_conversation uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if p_user is null or p_user = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_conversations
    where id = p_conversation and kind = 'group'
  ) then
    raise exception 'not_a_group' using errcode = 'P0001';
  end if;
  if not public.geegle_is_conversation_member(p_conversation) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  -- You may only invite someone you are actually friends with, and never a
  -- blocked pair.
  if not exists (
    select 1 from public.geegle_friendships
    where user_low = least(v_uid, p_user)
      and user_high = greatest(v_uid, p_user)
      and removed_at is null
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;
  if public.geegle_is_blocked(v_uid, p_user) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.geegle_conversation_members
    where conversation_id = p_conversation and user_id = p_user
  ) then
    return jsonb_build_object('status', 'already_member');
  end if;
  if (
    select count(*) from public.geegle_conversation_members
    where conversation_id = p_conversation
  ) >= 25 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('group_invite', 40, interval '1 hour');

  insert into public.geegle_conversation_members (conversation_id, user_id)
    values (p_conversation, p_user);

  update public.geegle_conversations set updated_at = now() where id = p_conversation;

  return jsonb_build_object('status', 'invited');
end;
$$;

create or replace function public.geegle_chat_leave_group(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_was_owner boolean;
  v_next uuid;
begin
  if not exists (
    select 1 from public.geegle_conversations
    where id = p_conversation and kind = 'group'
  ) then
    raise exception 'not_a_group' using errcode = 'P0001';
  end if;
  if not public.geegle_is_conversation_member(p_conversation) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  select role = 'owner' into v_was_owner
  from public.geegle_conversation_members
  where conversation_id = p_conversation and user_id = v_uid;

  delete from public.geegle_conversation_members
  where conversation_id = p_conversation and user_id = v_uid;

  select user_id into v_next
  from public.geegle_conversation_members
  where conversation_id = p_conversation
  order by joined_at
  limit 1;

  if v_next is null then
    delete from public.geegle_conversations where id = p_conversation;
    return jsonb_build_object('status', 'closed');
  end if;

  -- Ownership never disappears with the owner who left.
  if v_was_owner then
    update public.geegle_conversation_members
      set role = 'owner'
      where conversation_id = p_conversation and user_id = v_next;
  end if;

  return jsonb_build_object('status', 'left');
end;
$$;

create or replace function public.geegle_chat_transfer_ownership(p_conversation uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if p_user is null or p_user = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_conversation_members
    where conversation_id = p_conversation and user_id = v_uid and role = 'owner'
  ) then
    raise exception 'owner_only' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.geegle_conversation_members
    where conversation_id = p_conversation and user_id = p_user
  ) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  update public.geegle_conversation_members
    set role = 'member'
    where conversation_id = p_conversation and user_id = v_uid;
  update public.geegle_conversation_members
    set role = 'owner'
    where conversation_id = p_conversation and user_id = p_user;

  return jsonb_build_object('status', 'transferred');
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages
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
          'body', case when msg.unsent_at is null then msg.body else null end,
          'createdAt', msg.created_at,
          'editedAt', msg.edited_at,
          'unsent', msg.unsent_at is not null,
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
              and public.geegle_can_read(root.conversation_id)
          ) end
        ) as entry
      from public.geegle_messages msg
      left join public.geegle_profiles author on author.id = msg.author_id
      left join lateral (
        select r.id, r.conversation_id, r.created_at, r.unsent_at, r.author_id
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

create or replace function public.geegle_chat_send(p_conversation uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'message_empty' using errcode = 'P0001';
  end if;
  if char_length(v_body) > 4000 then
    raise exception 'message_too_long' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('chat_message', 40, interval '1 minute');

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
  select * into v_msg from public.geegle_messages where id = p_message;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'not_author' using errcode = 'P0001';
  end if;
  if v_msg.unsent_at is not null then
    raise exception 'message_unsent' using errcode = 'P0001';
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
  select * into v_msg from public.geegle_messages where id = p_message;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'not_author' using errcode = 'P0001';
  end if;
  if v_msg.unsent_at is not null then
    return jsonb_build_object('status', 'unsent');
  end if;

  -- The text is destroyed, not merely hidden: a forwarded reference to this
  -- row must resolve to "unavailable", never to the original words.
  update public.geegle_messages
    set body = '', unsent_at = now(), edited_at = null
    where id = p_message;

  return jsonb_build_object('status', 'unsent');
end;
$$;

create or replace function public.geegle_chat_hide(p_message uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_conversation uuid;
begin
  select conversation_id into v_conversation
  from public.geegle_messages where id = p_message;
  if v_conversation is null then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if not public.geegle_can_read(v_conversation) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;

  insert into public.geegle_message_hidden (message_id, user_id)
    values (p_message, v_uid)
    on conflict (message_id, user_id) do nothing;

  return jsonb_build_object('status', 'hidden');
end;
$$;

create or replace function public.geegle_chat_report(p_message uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_conversation uuid;
begin
  select conversation_id into v_conversation
  from public.geegle_messages where id = p_message;
  if v_conversation is null or not public.geegle_can_read(v_conversation) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 1 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('message_report', 5, interval '1 hour');

  insert into public.geegle_message_reports (message_id, reporter_id, reason)
    values (p_message, v_uid, left(v_reason, 500));

  return jsonb_build_object('status', 'reported');
end;
$$;

create or replace function public.geegle_chat_mark_read(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  insert into public.geegle_conversation_members (conversation_id, user_id, last_read_at)
    values (p_conversation, v_uid, now())
    on conflict (conversation_id, user_id) do update set last_read_at = now();

  return jsonb_build_object('status', 'read');
end;
$$;

-- ---------------------------------------------------------------------------
-- Forwarding
--
-- Public → DM is allowed when the recipient is an accepted friend. Group → DM
-- is allowed when the recipient is an accepted friend AND a current member of
-- that group. DM → anywhere is refused: DM content never leaves a DM. Nothing
-- is ever forwarded into the public room or into a group. A forward always
-- points at the original message, so forwarding a forward cannot be used to
-- hop around a permission check.
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
  v_other uuid;
  v_id uuid;
begin
  select * into v_msg from public.geegle_messages where id = p_message;
  if not found or v_msg.unsent_at is not null then
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

  if not exists (
    select 1 from public.geegle_friendships
    where user_low = least(v_uid, v_other)
      and user_high = greatest(v_uid, v_other)
      and removed_at is null
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;

  if v_source.kind = 'group' and not exists (
    select 1 from public.geegle_conversation_members
    where conversation_id = v_source.id and user_id = v_other
  ) then
    raise exception 'forward_not_allowed' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('chat_forward', 30, interval '1 minute');

  insert into public.geegle_messages (conversation_id, author_id, body, forwarded_from)
    values (p_conversation, v_uid, v_msg.body, coalesce(v_msg.forwarded_from, v_msg.id))
    returning id into v_id;

  update public.geegle_conversations set updated_at = now() where id = p_conversation;
  insert into public.geegle_conversation_members (conversation_id, user_id, last_read_at)
    values (p_conversation, v_uid, now())
    on conflict (conversation_id, user_id) do update set last_read_at = now();

  return jsonb_build_object('messageId', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-account DM background
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_set_background(
  p_conversation uuid,
  p_kind text,
  p_color text default null,
  p_image_path text default null,
  p_overlay integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_kind text := lower(btrim(coalesce(p_kind, 'default')));
  v_color text := nullif(btrim(coalesce(p_color, '')), '');
  v_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  v_overlay int := least(greatest(coalesce(p_overlay, 40), 0), 90);
begin
  if not exists (
    select 1 from public.geegle_conversations
    where id = p_conversation and kind = 'dm'
  ) then
    raise exception 'not_a_dm' using errcode = 'P0001';
  end if;
  if not public.geegle_is_conversation_member(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;
  if v_kind not in ('default', 'solid', 'color', 'image') then
    raise exception 'invalid_background' using errcode = 'P0001';
  end if;

  if v_kind in ('solid', 'color') then
    if v_color is null or v_color !~ '^#[0-9a-fA-F]{6}$' then
      raise exception 'invalid_color' using errcode = 'P0001';
    end if;
    v_path := null;
  elsif v_kind = 'image' then
    -- The object must live in this account's own folder for this conversation,
    -- so one account can never point at another account's picture.
    if v_path is null
      or v_path !~ ('^' || v_uid::text || '/' || p_conversation::text
        || '/[A-Za-z0-9._-]{1,120}$')
    then
      raise exception 'invalid_image' using errcode = 'P0001';
    end if;
    v_color := null;
  else
    v_color := null;
    v_path := null;
  end if;

  insert into public.geegle_dm_backgrounds
      (conversation_id, user_id, kind, color, image_path, overlay)
    values (p_conversation, v_uid, v_kind, v_color, v_path, v_overlay)
    on conflict (conversation_id, user_id) do update
      set kind = excluded.kind,
          color = excluded.color,
          image_path = excluded.image_path,
          overlay = excluded.overlay,
          updated_at = now();

  return jsonb_build_object(
    'kind', v_kind,
    'color', v_color,
    'imagePath', v_path,
    'overlay', v_overlay
  );
end;
$$;

create or replace function public.geegle_chat_background(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if not public.geegle_is_conversation_member(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  return (
    select jsonb_build_object(
             'kind', b.kind,
             'color', b.color,
             'imagePath', b.image_path,
             'overlay', b.overlay
           )
    from public.geegle_dm_backgrounds b
    where b.conversation_id = p_conversation and b.user_id = v_uid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Member list: names and roles for a conversation the caller can read.
-- ---------------------------------------------------------------------------

create or replace function public.geegle_chat_members(p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if not public.geegle_can_read(p_conversation) then
    raise exception 'conversation_not_found' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'userId', m.user_id,
             'username', p.username,
             'role', m.role,
             'joinedAt', m.joined_at
           ) order by m.joined_at)
    from public.geegle_conversation_members m
    join public.geegle_profiles p on p.id = m.user_id
    where m.conversation_id = p_conversation
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: signed-in accounts only, never anonymous.
-- ---------------------------------------------------------------------------

revoke execute on function public.geegle_chat_overview() from public, anon;
revoke execute on function public.geegle_chat_open_dm(uuid) from public, anon;
revoke execute on function public.geegle_chat_create_group(text) from public, anon;
revoke execute on function public.geegle_chat_rename_group(uuid, text) from public, anon;
revoke execute on function public.geegle_chat_invite(uuid, uuid) from public, anon;
revoke execute on function public.geegle_chat_leave_group(uuid) from public, anon;
revoke execute on function public.geegle_chat_transfer_ownership(uuid, uuid) from public, anon;
revoke execute on function public.geegle_chat_messages(uuid, timestamptz, uuid, integer) from public, anon;
revoke execute on function public.geegle_chat_send(uuid, text) from public, anon;
revoke execute on function public.geegle_chat_edit(uuid, text) from public, anon;
revoke execute on function public.geegle_chat_unsend(uuid) from public, anon;
revoke execute on function public.geegle_chat_hide(uuid) from public, anon;
revoke execute on function public.geegle_chat_report(uuid, text) from public, anon;
revoke execute on function public.geegle_chat_mark_read(uuid) from public, anon;
revoke execute on function public.geegle_chat_forward(uuid, uuid) from public, anon;
revoke execute on function public.geegle_chat_set_background(uuid, text, text, text, integer) from public, anon;
revoke execute on function public.geegle_chat_background(uuid) from public, anon;
revoke execute on function public.geegle_chat_members(uuid) from public, anon;

grant execute on function public.geegle_chat_overview() to authenticated;
grant execute on function public.geegle_chat_open_dm(uuid) to authenticated;
grant execute on function public.geegle_chat_create_group(text) to authenticated;
grant execute on function public.geegle_chat_rename_group(uuid, text) to authenticated;
grant execute on function public.geegle_chat_invite(uuid, uuid) to authenticated;
grant execute on function public.geegle_chat_leave_group(uuid) to authenticated;
grant execute on function public.geegle_chat_transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.geegle_chat_messages(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.geegle_chat_send(uuid, text) to authenticated;
grant execute on function public.geegle_chat_edit(uuid, text) to authenticated;
grant execute on function public.geegle_chat_unsend(uuid) to authenticated;
grant execute on function public.geegle_chat_hide(uuid) to authenticated;
grant execute on function public.geegle_chat_report(uuid, text) to authenticated;
grant execute on function public.geegle_chat_mark_read(uuid) to authenticated;
grant execute on function public.geegle_chat_forward(uuid, uuid) to authenticated;
grant execute on function public.geegle_chat_set_background(uuid, text, text, text, integer) to authenticated;
grant execute on function public.geegle_chat_background(uuid) to authenticated;
grant execute on function public.geegle_chat_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new and edited messages, and membership changes, stream to
-- authorized subscribers (the RLS policies above decide what each may see).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.geegle_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.geegle_conversations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.geegle_conversation_members;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private storage for DM background images. Objects live under
-- <user id>/<conversation id>/<file>, and the policies below only ever expose
-- an account's own folder. The bucket is private: no public URL exists.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; bucket skipped';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'geegle-chat-backgrounds',
      'geegle-chat-backgrounds',
      false,
      3145728,
      array['image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

  begin
    drop policy if exists geegle_chat_bg_select on storage.objects;
    create policy geegle_chat_bg_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'geegle-chat-backgrounds'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );

    drop policy if exists geegle_chat_bg_insert on storage.objects;
    create policy geegle_chat_bg_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'geegle-chat-backgrounds'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );

    drop policy if exists geegle_chat_bg_update on storage.objects;
    create policy geegle_chat_bg_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'geegle-chat-backgrounds'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );

    drop policy if exists geegle_chat_bg_delete on storage.objects;
    create policy geegle_chat_bg_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'geegle-chat-backgrounds'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  exception when insufficient_privilege then
    raise notice 'no privilege on storage.objects; policies skipped';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validation: abort if a client can write a chat table or anonymous callers
-- can reach a chat function.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  select string_agg(t.tbl || ':' || p.priv, ', ') into v_bad
  from (values
    ('geegle_conversations'), ('geegle_conversation_members'),
    ('geegle_messages'), ('geegle_message_hidden'),
    ('geegle_message_reports'), ('geegle_dm_backgrounds')
  ) as t(tbl)
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as p(priv)
  where has_table_privilege('authenticated', 'public.' || t.tbl, p.priv)
     or has_table_privilege('anon', 'public.' || t.tbl, p.priv);

  if v_bad is not null then
    raise exception 'post-check failed: client write privileges remain on %', v_bad;
  end if;

  if has_function_privilege('anon', 'public.geegle_chat_overview()', 'EXECUTE')
     or has_function_privilege('anon', 'public.geegle_chat_send(uuid, text)', 'EXECUTE')
  then
    raise exception 'post-check failed: anon can execute a chat function';
  end if;

  raise notice 'post-check ok: chat writes are function-only';
end;
$$;
