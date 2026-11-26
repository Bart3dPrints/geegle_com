-- 0005: make username-only registration work on a project that requires email
-- confirmation, and repair a drifted signup trigger.
--
-- Verified facts this migration is built on (2026-11-26):
--   * Both hosted projects run with `mailer_autoconfirm = false`
--     (`GET /auth/v1/settings`).
--   * GoTrue's signup handler reloads the user row after INSERT and skips the
--     confirmation email when the row is already confirmed, issuing a session
--     instead (supabase/auth internal/api/signup.go).
--   * Production signup currently fails with HTTP 500
--     `23503 ... geegle_profiles_id_fkey ... Key (id)=(...) is not present in
--     table "users"`, i.e. the provisioning trigger inserts the profile row
--     before the `auth.users` row exists (a BEFORE INSERT trigger or an FK
--     pointing at another table).
--
-- Everything here is scoped to the synthetic namespace
-- `@users.geegle.internal`; no other application sharing this project is
-- affected, and the project-wide "Confirm email" setting is left alone.
--
-- Idempotent: safe to run more than once. Run it inside a transaction with a
-- backup available.

-- 1. Make the profile FK point at auth.users. Dropping and re-adding repairs
--    a constraint that drifted to another table.
do $$
declare
  v_target text;
begin
  select format('%s.%s', n.nspname, c.relname)
    into v_target
  from pg_constraint k
  join pg_class c on c.oid = k.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  where k.conrelid = 'public.geegle_profiles'::regclass
    and k.conname = 'geegle_profiles_id_fkey';

  raise notice 'geegle_profiles_id_fkey previously referenced: %',
    coalesce(v_target, '(constraint missing)');
end
$$;

alter table public.geegle_profiles
  drop constraint if exists geegle_profiles_id_fkey;

alter table public.geegle_profiles
  add constraint geegle_profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade not valid;

-- NOT VALID still enforces every new row; validate existing rows separately so
-- a pre-existing orphan does not abort the whole migration.
do $$
begin
  alter table public.geegle_profiles validate constraint geegle_profiles_id_fkey;
exception
  when others then
    raise warning 'geegle_profiles has orphan rows; FK left NOT VALID: %', sqlerrm;
end
$$;

-- 2. Case-insensitive username uniqueness, enforced by the database rather
--    than a frontend availability check.
do $$
begin
  create unique index if not exists geegle_profiles_username_lower_key
    on public.geegle_profiles (lower(username));
exception
  when unique_violation then
    raise warning 'case-insensitive username index not created: duplicate usernames already exist';
end
$$;

-- 3. Provision profile + settings AFTER the auth.users row exists.
drop trigger if exists geegle_on_auth_user_created on auth.users;

create or replace function public.geegle_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

create trigger geegle_on_auth_user_created
  after insert on auth.users
  for each row execute function public.geegle_handle_new_user();

-- 4. Namespace-scoped confirmation. Only Geegle's synthetic addresses are
--    confirmed, and only at creation time. Real addresses belonging to other
--    applications in this project keep the project-wide confirmation rule.
create or replace function public.geegle_confirm_synthetic_email()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists geegle_confirm_synthetic_email on auth.users;
create trigger geegle_confirm_synthetic_email
  before insert on auth.users
  for each row execute function public.geegle_confirm_synthetic_email();

-- 5. Backfill existing Geegle accounts: confirm them so they can sign in, and
--    create the profile row the drifted trigger never wrote. No account is
--    deleted, recreated or given a new password.
do $$
begin
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
exception
  when unique_violation then
    raise warning 'backfill skipped: a case-insensitive username collision exists';
end
$$;
