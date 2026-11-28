-- Rollback for 0007_geegle_social.sql (production project oizdbkxnzwatytxcrvoo).
--
-- Scope: drops ONLY the objects created by 0007. No other application's table,
-- no auth user, no game save is touched.
--
-- Use this only if 0007 has to be undone. Dropping the tables removes the
-- friendships, requests, blocks and reports those tables hold; nothing outside
-- Geegle is affected.

begin;

-- 1. Stop streaming the tables first, so Realtime cannot hold a lock on them.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.geegle_friend_requests;
    exception when undefined_object then null;
    end;
    begin
      alter publication supabase_realtime drop table public.geegle_friendships;
    exception when undefined_object then null;
    end;
  end if;
end;
$$;

-- 2. Functions (drop by signature; if exists guards a partially applied run).
drop function if exists public.geegle_list_social();
drop function if exists public.geegle_report_user(uuid, text);
drop function if exists public.geegle_unblock_user(uuid);
drop function if exists public.geegle_block_user(uuid);
drop function if exists public.geegle_remove_friend(uuid);
drop function if exists public.geegle_cancel_friend_request(uuid);
drop function if exists public.geegle_respond_friend_request(uuid, boolean);
drop function if exists public.geegle_send_friend_request(uuid);
drop function if exists public.geegle_search_users(text);
drop function if exists public.geegle_is_blocked(uuid, uuid);
drop function if exists public.geegle_rate_limit(text, int, interval);
drop function if exists public.geegle_require_uid();

-- 3. Tables (policies and indexes belong to them and go with them).
drop table if exists public.geegle_reports;
drop table if exists public.geegle_blocks;
drop table if exists public.geegle_friendships;
drop table if exists public.geegle_friend_requests;
drop table if exists public.geegle_social_rate;

commit;

-- Verification after a rollback: must return zero rows.
--   select table_name from information_schema.tables
--    where table_schema = 'public' and table_name like 'geegle\_%' escape '\'
--      and table_name in ('geegle_friend_requests','geegle_friendships',
--                         'geegle_blocks','geegle_reports','geegle_social_rate');
