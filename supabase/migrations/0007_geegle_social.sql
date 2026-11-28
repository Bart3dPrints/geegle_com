-- 0007: friends, friend requests, blocking and account reporting.
--
-- Design notes
-- ------------
-- Everything in this migration is Geegle-prefixed and lives in `public`, so it
-- cannot collide with the other application that shares this project.
--
-- Writes are NOT granted to clients. Every mutation goes through a
-- security-definer function that derives the caller from auth.uid(); a client
-- can never name itself with a supplied id. Clients get SELECT only, scoped by
-- RLS, which is what Realtime needs to deliver live row changes.
--
-- A friendship is stored once, with the two accounts in ascending UUID order,
-- so (a, b) and (b, a) cannot both exist. Pending requests are unique on the
-- unordered pair, so neither direction can be duplicated.
--
-- Blocking is symmetric in effect: a block in either direction prevents
-- requests, removes the friendship and cancels pending requests.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.geegle_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geegle_friend_requests_not_self check (sender_id <> recipient_id)
);

-- One live request per unordered pair, in either direction.
create unique index if not exists geegle_friend_requests_pending_pair
  on public.geegle_friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';
create index if not exists geegle_friend_requests_recipient_idx
  on public.geegle_friend_requests (recipient_id, status);
create index if not exists geegle_friend_requests_sender_idx
  on public.geegle_friend_requests (sender_id, status);

create table if not exists public.geegle_friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A removal is recorded, not deleted: Realtime can only deliver row changes
  -- it can check against RLS, and a deleted row cannot be checked. Recording
  -- the removal lets both accounts hear about it live.
  removed_at timestamptz,
  primary key (user_low, user_high),
  constraint geegle_friendships_ordered check (user_low < user_high)
);
alter table public.geegle_friendships add column if not exists removed_at timestamptz;
create index if not exists geegle_friendships_high_idx
  on public.geegle_friendships (user_high);

create table if not exists public.geegle_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint geegle_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists geegle_blocks_blocked_idx
  on public.geegle_blocks (blocked_id);

create table if not exists public.geegle_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint geegle_reports_not_self check (reporter_id <> reported_id)
);
create index if not exists geegle_reports_reported_idx
  on public.geegle_reports (reported_id, created_at desc);

-- Fixed-window rate limiting for social actions. No client access at all.
create table if not exists public.geegle_social_rate (
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists geegle_social_rate_idx
  on public.geegle_social_rate (user_id, action, at desc);

-- ---------------------------------------------------------------------------
-- Row level security: clients may read their own side of a relationship only.
-- ---------------------------------------------------------------------------

alter table public.geegle_friend_requests enable row level security;
alter table public.geegle_friendships enable row level security;
alter table public.geegle_blocks enable row level security;
alter table public.geegle_reports enable row level security;
alter table public.geegle_social_rate enable row level security;

drop policy if exists geegle_friend_requests_select_involved on public.geegle_friend_requests;
create policy geegle_friend_requests_select_involved on public.geegle_friend_requests
  for select using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

drop policy if exists geegle_friendships_select_involved on public.geegle_friendships;
create policy geegle_friendships_select_involved on public.geegle_friendships
  for select using ((select auth.uid()) = user_low or (select auth.uid()) = user_high);

-- Only the blocker can see a block. A blocked account cannot learn who blocked
-- it, and cannot enumerate blocks.
drop policy if exists geegle_blocks_select_own on public.geegle_blocks;
create policy geegle_blocks_select_own on public.geegle_blocks
  for select using ((select auth.uid()) = blocker_id);

drop policy if exists geegle_reports_select_own on public.geegle_reports;
create policy geegle_reports_select_own on public.geegle_reports
  for select using ((select auth.uid()) = reporter_id);

-- ---------------------------------------------------------------------------
-- Grants: read-only for clients; every write path is a function.
-- ---------------------------------------------------------------------------

revoke all on public.geegle_friend_requests from anon, authenticated;
revoke all on public.geegle_friendships from anon, authenticated;
revoke all on public.geegle_blocks from anon, authenticated;
revoke all on public.geegle_reports from anon, authenticated;
revoke all on public.geegle_social_rate from anon, authenticated;

grant select on public.geegle_friend_requests to authenticated;
grant select on public.geegle_friendships to authenticated;
grant select on public.geegle_blocks to authenticated;
grant select on public.geegle_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.geegle_require_uid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Counts the caller's recent actions of one kind and records the new one.
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

  select count(*) into v_count
  from public.geegle_social_rate
  where user_id = v_uid and action = p_action and at > now() - p_window;

  if v_count >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.geegle_social_rate (user_id, action) values (v_uid, p_action);

  -- Keep the table bounded; a day of history is far more than any window needs.
  delete from public.geegle_social_rate where at < now() - interval '1 day';
end;
$$;

-- True when either account has blocked the other.
create or replace function public.geegle_is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.geegle_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Account discovery
-- ---------------------------------------------------------------------------

create or replace function public.geegle_search_users(p_query text)
returns table (user_id uuid, username text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_term text;
begin
  perform public.geegle_rate_limit('search', 30, interval '1 minute');

  v_term := lower(btrim(coalesce(p_query, '')));
  if char_length(v_term) < 2 then
    return;
  end if;
  -- A literal prefix match only: no wildcard injection, no full-table scan of
  -- arbitrary substrings beyond the trigram-friendly prefix.
  v_term := replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_');

  return query
    select p.id, p.username
    from public.geegle_profiles p
    where p.id <> v_uid
      and lower(p.username) like v_term || '%'
      and not public.geegle_is_blocked(v_uid, p.id)
    order by lower(p.username)
    limit 10;
end;
$$;

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------

create or replace function public.geegle_send_friend_request(p_recipient uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_existing public.geegle_friend_requests%rowtype;
  v_id uuid;
begin
  if p_recipient is null then
    raise exception 'recipient_required' using errcode = 'P0001';
  end if;
  if p_recipient = v_uid then
    raise exception 'self_request' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.geegle_profiles where id = p_recipient) then
    raise exception 'recipient_not_found' using errcode = 'P0001';
  end if;
  if public.geegle_is_blocked(v_uid, p_recipient) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.geegle_friendships
    where user_low = least(v_uid, p_recipient)
      and user_high = greatest(v_uid, p_recipient)
      and removed_at is null
  ) then
    return jsonb_build_object('status', 'already_friends');
  end if;

  perform public.geegle_rate_limit('request', 20, interval '1 hour');

  select * into v_existing
  from public.geegle_friend_requests
  where status = 'pending'
    and least(sender_id, recipient_id) = least(v_uid, p_recipient)
    and greatest(sender_id, recipient_id) = greatest(v_uid, p_recipient)
  for update;

  if found then
    if v_existing.sender_id = v_uid then
      return jsonb_build_object('status', 'duplicate', 'id', v_existing.id);
    end if;
    -- The other account already asked: mutual interest is an acceptance.
    update public.geegle_friend_requests
      set status = 'accepted', updated_at = now()
      where id = v_existing.id;
    insert into public.geegle_friendships (user_low, user_high, removed_at)
      values (least(v_uid, p_recipient), greatest(v_uid, p_recipient), null)
      on conflict (user_low, user_high) do update set removed_at = null, created_at = now();
    return jsonb_build_object('status', 'accepted', 'id', v_existing.id);
  end if;

  insert into public.geegle_friend_requests (sender_id, recipient_id)
    values (v_uid, p_recipient)
    returning id into v_id;

  return jsonb_build_object('status', 'pending', 'id', v_id);
end;
$$;

create or replace function public.geegle_respond_friend_request(p_request uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_req public.geegle_friend_requests%rowtype;
begin
  select * into v_req
  from public.geegle_friend_requests
  where id = p_request and recipient_id = v_uid and status = 'pending'
  for update;

  if not found then
    -- Covers a request addressed to someone else, a missing request and one
    -- that already moved on.
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.geegle_friend_requests
      set status = 'declined', updated_at = now()
      where id = v_req.id;
    return jsonb_build_object('status', 'declined');
  end if;

  if public.geegle_is_blocked(v_uid, v_req.sender_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  update public.geegle_friend_requests
    set status = 'accepted', updated_at = now()
    where id = v_req.id;

  insert into public.geegle_friendships (user_low, user_high, removed_at)
    values (least(v_uid, v_req.sender_id), greatest(v_uid, v_req.sender_id), null)
    on conflict (user_low, user_high) do update set removed_at = null, created_at = now();

  return jsonb_build_object('status', 'accepted');
end;
$$;

create or replace function public.geegle_cancel_friend_request(p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  update public.geegle_friend_requests
    set status = 'cancelled', updated_at = now()
    where id = p_request and sender_id = v_uid and status = 'pending';

  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  return jsonb_build_object('status', 'cancelled');
end;
$$;

create or replace function public.geegle_remove_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if p_other is null or p_other = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  update public.geegle_friendships
    set removed_at = now()
    where user_low = least(v_uid, p_other)
      and user_high = greatest(v_uid, p_other)
      and removed_at is null;

  return jsonb_build_object('status', 'removed');
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocking
-- ---------------------------------------------------------------------------

create or replace function public.geegle_block_user(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if p_other is null or p_other = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.geegle_profiles where id = p_other) then
    raise exception 'recipient_not_found' using errcode = 'P0001';
  end if;

  insert into public.geegle_blocks (blocker_id, blocked_id)
    values (v_uid, p_other)
    on conflict do nothing;

  update public.geegle_friendships
    set removed_at = now()
    where user_low = least(v_uid, p_other)
      and user_high = greatest(v_uid, p_other)
      and removed_at is null;

  update public.geegle_friend_requests
    set status = 'cancelled', updated_at = now()
    where status = 'pending'
      and least(sender_id, recipient_id) = least(v_uid, p_other)
      and greatest(sender_id, recipient_id) = greatest(v_uid, p_other);

  return jsonb_build_object('status', 'blocked');
end;
$$;

create or replace function public.geegle_unblock_user(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  if p_other is null then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;

  delete from public.geegle_blocks
  where blocker_id = v_uid and blocked_id = p_other;

  return jsonb_build_object('status', 'unblocked');
end;
$$;

create or replace function public.geegle_report_user(p_reported uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_reported is null or p_reported = v_uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 1 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  perform public.geegle_rate_limit('report', 5, interval '1 hour');

  insert into public.geegle_reports (reporter_id, reported_id, reason)
    values (v_uid, p_reported, left(v_reason, 500));

  return jsonb_build_object('status', 'reported');
end;
$$;

-- ---------------------------------------------------------------------------
-- One read for the whole Friends surface
-- ---------------------------------------------------------------------------

create or replace function public.geegle_list_social()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
begin
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', p.id,
               'username', p.username,
               'since', f.created_at
             ) order by lower(p.username))
      from public.geegle_friendships f
      join public.geegle_profiles p
        on p.id = case when f.user_low = v_uid then f.user_high else f.user_low end
      where (f.user_low = v_uid or f.user_high = v_uid)
        and f.removed_at is null
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
               'requestId', r.id,
               'userId', p.id,
               'username', p.username,
               'createdAt', r.created_at
             ) order by r.created_at)
      from public.geegle_friend_requests r
      join public.geegle_profiles p on p.id = r.sender_id
      where r.recipient_id = v_uid and r.status = 'pending'
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
               'requestId', r.id,
               'userId', p.id,
               'username', p.username,
               'createdAt', r.created_at
             ) order by r.created_at)
      from public.geegle_friend_requests r
      join public.geegle_profiles p on p.id = r.recipient_id
      where r.sender_id = v_uid and r.status = 'pending'
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', p.id,
               'username', p.username
             ) order by lower(p.username))
      from public.geegle_blocks b
      join public.geegle_profiles p on p.id = b.blocked_id
      where b.blocker_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: signed-in accounts only, and never anonymous.
-- ---------------------------------------------------------------------------

revoke execute on function public.geegle_require_uid() from public, anon, authenticated;
revoke execute on function public.geegle_rate_limit(text, int, interval) from public, anon, authenticated;
revoke execute on function public.geegle_is_blocked(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.geegle_search_users(text) from public, anon;
revoke execute on function public.geegle_send_friend_request(uuid) from public, anon;
revoke execute on function public.geegle_respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.geegle_cancel_friend_request(uuid) from public, anon;
revoke execute on function public.geegle_remove_friend(uuid) from public, anon;
revoke execute on function public.geegle_block_user(uuid) from public, anon;
revoke execute on function public.geegle_unblock_user(uuid) from public, anon;
revoke execute on function public.geegle_report_user(uuid, text) from public, anon;
revoke execute on function public.geegle_list_social() from public, anon;

grant execute on function public.geegle_search_users(text) to authenticated;
grant execute on function public.geegle_send_friend_request(uuid) to authenticated;
grant execute on function public.geegle_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.geegle_cancel_friend_request(uuid) to authenticated;
grant execute on function public.geegle_remove_friend(uuid) to authenticated;
grant execute on function public.geegle_block_user(uuid) to authenticated;
grant execute on function public.geegle_unblock_user(uuid) to authenticated;
grant execute on function public.geegle_report_user(uuid, text) to authenticated;
grant execute on function public.geegle_list_social() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: friend requests and friendships stream changes to authorized
-- subscribers (RLS above decides which rows each account may see).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.geegle_friend_requests;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.geegle_friendships;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validation: abort the migration if a client can write a social table.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  select string_agg(t.tbl || ':' || p.priv, ', ') into v_bad
  from (values
    ('geegle_friend_requests'), ('geegle_friendships'), ('geegle_blocks'),
    ('geegle_reports'), ('geegle_social_rate')
  ) as t(tbl)
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as p(priv)
  where has_table_privilege('authenticated', 'public.' || t.tbl, p.priv)
     or has_table_privilege('anon', 'public.' || t.tbl, p.priv);

  if v_bad is not null then
    raise exception 'post-check failed: client write privileges remain on %', v_bad;
  end if;

  if has_function_privilege('anon', 'public.geegle_search_users(text)', 'EXECUTE') then
    raise exception 'post-check failed: anon can execute a social function';
  end if;

  raise notice 'post-check ok: social writes are function-only';
end;
$$;
