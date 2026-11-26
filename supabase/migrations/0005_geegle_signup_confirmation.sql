-- 0005 (hardened): make username-only registration work on a project that
-- requires email confirmation, and repair the drifted signup trigger.
--
-- Facts this migration is built on (verified against production
-- oizdbkxnzwatytxcrvoo on 2026-11-26):
--   * `geegle_on_auth_user_created` was BEFORE INSERT, so the profile row was
--     inserted before the auth.users row existed and every signup failed with
--     23503 on geegle_profiles_id_fkey.
--   * Both hosted projects run `mailer_autoconfirm = false`, and GoTrue skips
--     the confirmation mail and issues a session when the row is already
--     confirmed (supabase/auth internal/api/signup.go).
--
-- Nothing here changes the project-wide "Confirm email" setting, and only
-- addresses ending in @users.geegle.internal are touched, so other applications
-- sharing this project keep their own behaviour.
--
-- This migration deliberately has NO exception handlers around required work:
-- a duplicate username, an orphan profile, or a failed validation aborts the
-- whole migration instead of leaving a half-repaired schema behind.

-- ---------------------------------------------------------------------------
-- Preflight: refuse to run on a database that cannot be repaired safely.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dupes int;
  v_orphans int;
  v_timing text;
begin
  select count(*) into v_dupes
  from (
    select lower(username)
    from public.geegle_profiles
    group by 1
    having count(*) > 1
  ) duplicates;
  if v_dupes > 0 then
    raise exception
      'preflight failed: % case-insensitive duplicate username group(s) exist; resolve them before applying 0005', v_dupes;
  end if;

  select count(*) into v_orphans
  from public.geegle_profiles p
  left join auth.users u on u.id = p.id
  where u.id is null;
  if v_orphans > 0 then
    raise exception
      'preflight failed: % geegle_profiles row(s) have no auth.users row; resolve them before applying 0005', v_orphans;
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end
    into v_timing
  from pg_trigger
  where tgrelid = 'auth.users'::regclass
    and tgname = 'geegle_on_auth_user_created';

  raise notice 'preflight ok: provisioning trigger timing was %',
    coalesce(v_timing, '(absent)');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Profile FK must reference auth.users.
-- ---------------------------------------------------------------------------
alter table public.geegle_profiles
  drop constraint if exists geegle_profiles_id_fkey;

alter table public.geegle_profiles
  add constraint geegle_profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Case-insensitive username uniqueness, enforced by the database.
-- ---------------------------------------------------------------------------
create unique index if not exists geegle_profiles_username_lower_key
  on public.geegle_profiles (lower(username));

-- ---------------------------------------------------------------------------
-- 3. Provision the profile and settings row AFTER the auth user exists.
-- ---------------------------------------------------------------------------
create or replace function public.geegle_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  if new.email is null or new.email not like '%@users.geegle.internal' then
    return new;
  end if;

  v_username := lower(btrim(split_part(new.email, '@', 1)));

  insert into public.geegle_profiles (id, username)
  values (new.id, v_username)
  on conflict (id) do update
    set username = excluded.username,
        updated_at = now();

  insert into public.geegle_user_settings (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.geegle_handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- 4. Confirm only Geegle's synthetic namespace, at creation time.
--    GoTrue reloads the row, sees it confirmed, skips the mailer and issues a
--    session instead of a 500/429 from the confirmation mail.
-- ---------------------------------------------------------------------------
create or replace function public.geegle_confirm_synthetic_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null
     and new.email like '%@users.geegle.internal'
     and new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.geegle_confirm_synthetic_email() from public;

drop trigger if exists geegle_on_auth_user_created on auth.users;
create trigger geegle_on_auth_user_created
  after insert on auth.users
  for each row execute function public.geegle_handle_new_user();

drop trigger if exists geegle_confirm_synthetic_email on auth.users;
create trigger geegle_confirm_synthetic_email
  before insert on auth.users
  for each row execute function public.geegle_confirm_synthetic_email();

-- ---------------------------------------------------------------------------
-- 5. Backfill existing Geegle accounts: activate them and give them the rows
--    the broken trigger never wrote. No account is deleted or re-passworded.
-- ---------------------------------------------------------------------------
update auth.users
   set email_confirmed_at = now()
 where email like '%@users.geegle.internal'
   and email_confirmed_at is null;

insert into public.geegle_profiles (id, username)
select u.id, lower(btrim(split_part(u.email, '@', 1)))
  from auth.users u
 where u.email like '%@users.geegle.internal'
on conflict (id) do nothing;

insert into public.geegle_user_settings (id)
select u.id
  from auth.users u
 where u.email like '%@users.geegle.internal'
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Post-migration validation: abort unless the repaired shape is in place.
-- ---------------------------------------------------------------------------
do $$
declare
  v_timing text;
  v_confirm text;
  v_index boolean;
  v_fk boolean;
begin
  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end
    into v_timing
  from pg_trigger
  where tgrelid = 'auth.users'::regclass
    and tgname = 'geegle_on_auth_user_created';
  if v_timing is distinct from 'AFTER' then
    raise exception 'post-check failed: provisioning trigger timing is % (expected AFTER)',
      coalesce(v_timing, 'absent');
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end
    into v_confirm
  from pg_trigger
  where tgrelid = 'auth.users'::regclass
    and tgname = 'geegle_confirm_synthetic_email';
  if v_confirm is distinct from 'BEFORE' then
    raise exception 'post-check failed: namespace confirmation trigger is % (expected BEFORE)',
      coalesce(v_confirm, 'absent');
  end if;

  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'geegle_profiles_username_lower_key'
  ) into v_index;
  if not v_index then
    raise exception 'post-check failed: case-insensitive username index missing';
  end if;

  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.geegle_profiles'::regclass
      and conname = 'geegle_profiles_id_fkey'
      and confrelid = 'auth.users'::regclass
  ) into v_fk;
  if not v_fk then
    raise exception 'post-check failed: profile foreign key does not reference auth.users';
  end if;

  raise notice 'post-check ok: AFTER provisioning, BEFORE namespace confirmation, FK to auth.users, case-insensitive index present';
end;
$$;
