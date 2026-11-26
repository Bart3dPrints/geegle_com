-- 0006: least-privilege grants for the Geegle tables in a shared project.
--
-- Verified state before this migration: `anon` held SELECT and INSERT on every
-- geegle_* table, including geegle_entry_config (the retired entry-gate hash),
-- and the retired RPC geegle_verify_entry_password was executable by anon.
-- Row-level security was the only thing protecting them.
--
-- All Geegle data belongs to a signed-in account, so anonymous API roles do not
-- need table access at all. RLS is NOT touched, no policy is weakened, and the
-- other application's tables are not referenced.

-- 1. Remove anonymous access to Geegle data.
revoke all on public.geegle_profiles from anon;
revoke all on public.geegle_user_settings from anon;
revoke all on public.geegle_favorites from anon;
revoke all on public.geegle_recently_played from anon;
revoke all on public.geegle_game_saves from anon;

-- 2. The retired entry gate keeps no client access whatsoever: RLS has no
--    policies for these tables and no client code path uses them.
revoke all on public.geegle_entry_attempts from anon, authenticated;
revoke all on public.geegle_entry_config from anon, authenticated;
revoke execute on function public.geegle_verify_entry_password(text, text) from public, anon, authenticated;

-- 3. Explicit grants for signed-in accounts (mirrors 0004; RLS still decides
--    which rows are visible or writable).
grant usage on schema public to authenticated;
grant select, insert, update on public.geegle_profiles to authenticated;
grant select, insert, update on public.geegle_user_settings to authenticated;
grant select, insert, delete on public.geegle_favorites to authenticated;
grant select, insert, update, delete on public.geegle_recently_played to authenticated;
grant select, insert, update, delete on public.geegle_game_saves to authenticated;

-- 4. The shared updated_at helper is a trigger function; no client needs to call it.
revoke execute on function public.geegle_touch_updated_at() from public, anon, authenticated;

-- 5. Validation: abort if anonymous access survived anywhere.
do $$
declare
  v_leaks text;
begin
  select string_agg(t.tbl, ', ') into v_leaks
  from (values
    ('geegle_profiles'),
    ('geegle_user_settings'),
    ('geegle_favorites'),
    ('geegle_recently_played'),
    ('geegle_game_saves'),
    ('geegle_entry_attempts'),
    ('geegle_entry_config')
  ) as t(tbl)
  where has_table_privilege('anon', 'public.' || t.tbl, 'SELECT')
     or has_table_privilege('anon', 'public.' || t.tbl, 'INSERT')
     or has_table_privilege('anon', 'public.' || t.tbl, 'UPDATE')
     or has_table_privilege('anon', 'public.' || t.tbl, 'DELETE');

  if v_leaks is not null then
    raise exception 'post-check failed: anon still has privileges on %', v_leaks;
  end if;

  if has_function_privilege('anon', 'public.geegle_verify_entry_password(text, text)', 'EXECUTE') then
    raise exception 'post-check failed: anon can still execute the retired entry-gate function';
  end if;

  raise notice 'post-check ok: no anonymous access to Geegle tables or the retired entry gate';
end;
$$;
