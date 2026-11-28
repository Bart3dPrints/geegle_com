-- 0010: serialise the account-pair operations that can race.
--
-- A block and a friend-request acceptance that run at the same time could each
-- pass its own check before the other committed, leaving a friendship between
-- accounts where one had blocked the other. Sequential tests never see this.
-- Taking a transaction-scoped advisory lock on the ordered pair makes the two
-- operations queue behind each other, so the later one re-reads the committed
-- state and refuses.

create or replace function public.geegle_pair_lock(p_one uuid, p_two uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select pg_advisory_xact_lock(
    hashtextextended(
      least(p_one, p_two)::text || ':' || greatest(p_one, p_two)::text,
      0
    )
  );
$$;

revoke execute on function public.geegle_pair_lock(uuid, uuid) from public, anon, authenticated;

create or replace function public.geegle_respond_friend_request(p_request uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.geegle_require_uid();
  v_sender uuid;
  v_req public.geegle_friend_requests%rowtype;
begin
  -- The sender is read first only to name the lock; everything that decides the
  -- outcome is read again after the lock is held.
  select sender_id into v_sender
  from public.geegle_friend_requests
  where id = p_request and recipient_id = v_uid and status = 'pending';

  if v_sender is null then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  perform public.geegle_pair_lock(v_uid, v_sender);

  select * into v_req
  from public.geegle_friend_requests
  where id = p_request and recipient_id = v_uid and status = 'pending'
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.geegle_friend_requests
      set status = 'declined', updated_at = now()
      where id = v_req.id;
    return jsonb_build_object('status', 'declined');
  end if;

  if exists (
    select 1 from public.geegle_blocks
    where (blocker_id = v_uid and blocked_id = v_req.sender_id)
       or (blocker_id = v_req.sender_id and blocked_id = v_uid)
  ) then
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

  perform public.geegle_pair_lock(v_uid, p_other);

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

revoke execute on function public.geegle_respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.geegle_block_user(uuid) from public, anon;

-- The guard must not fire on the update that *removes* a friendship, otherwise
-- blocking an account rolls back its own block while trying to record the
-- removal. It applies only while a friendship would be active.
create or replace function public.geegle_tg_friendship_requires_no_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.removed_at is null and public.geegle_is_blocked(new.user_low, new.user_high) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
