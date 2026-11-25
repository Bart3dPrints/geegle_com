-- Table privileges for the Data API roles.
--
-- 0001 creates the tables and their RLS policies but never grants privileges,
-- so a freshly provisioned project rejects every Geegle query with
-- "permission denied for table ..." before RLS is even consulted. Production
-- has these grants (applied by hand); this migration makes a new project
-- behave the same way.
--
-- Row-level security is still what separates accounts: these grants only let
-- the API reach the tables. The gate tables (geegle_entry_attempts,
-- geegle_entry_config) deliberately get no client grants - RLS has no policies
-- for them and only the security-definer verify function touches them.

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.geegle_profiles to authenticated;
grant select, insert, update on public.geegle_user_settings to authenticated;
grant select, insert, delete on public.geegle_favorites to authenticated;
grant select, insert, update, delete on public.geegle_recently_played to authenticated;
grant select, insert, update, delete on public.geegle_game_saves to authenticated;

-- The entry gate runs before sign-in, so anonymous visitors must be able to
-- call the RPC (it is granted in 0001); they still get no table privileges.
