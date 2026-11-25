-- Geegle platform schema. All Geegle tables live in a dedicated `geegle`
-- schema, isolated from other applications that may share the Supabase
-- project. Row Level Security is enabled on every table; policies allow a
-- user to read/write ONLY their own rows.

create schema if not exists geegle;

-- 1. Profile: one row per auth user, public username.
create table if not exists geegle.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table geegle.profiles enable row level security;

create policy "geegle_profiles_select_own" on geegle.profiles
  for select using (auth.uid() = id);
create policy "geegle_profiles_update_own" on geegle.profiles
  for update using (auth.uid() = id);

-- 2. Signup trigger: only for Geegle's synthetic usernames
--    (email domain users.geegle.internal is exclusive to this app).
create or replace function geegle.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = geegle
as $$
begin
  if new.email like '%@users.geegle.internal' then
    insert into geegle.profiles (id, username)
    values (new.id, lower(split_part(new.email, '@', 1)))
    on conflict (id) do update
      set username = excluded.username, updated_at = now();
    insert into geegle.user_settings (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- Email-local-part change keeps the username in sync (defensive).
create or replace function geegle.handle_email_change()
returns trigger
language plpgsql
security definer
set search_path = geegle
as $$
begin
  if new.email like '%@users.geegle.internal' then
    update geegle.profiles
    set username = lower(split_part(new.email, '@', 1)), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

-- 3. Per-user settings: theme + preferences JSON (default proxy servers etc).
create table if not exists geegle.user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table geegle.user_settings enable row level security;

create policy "geegle_user_settings_select_own" on geegle.user_settings
  for select using (auth.uid() = id);
create policy "geegle_user_settings_insert_own" on geegle.user_settings
  for insert with check (auth.uid() = id);
create policy "geegle_user_settings_update_own" on geegle.user_settings
  for update using (auth.uid() = id);

-- Triggers on auth.users (guarded to Geegle synthetic emails only).
drop trigger if exists geegle_on_auth_user_created on auth.users;
create trigger geegle_on_auth_user_created
  after insert on auth.users
  for each row execute function geegle.handle_new_user();

drop trigger if exists geegle_on_auth_email_changed on auth.users;
create trigger geegle_on_auth_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function geegle.handle_email_change();

-- 4. Favorites.
create table if not exists geegle.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table geegle.favorites enable row level security;

create policy "geegle_favorites_select_own" on geegle.favorites
  for select using (auth.uid() = user_id);
create policy "geegle_favorites_insert_own" on geegle.favorites
  for insert with check (auth.uid() = user_id);
create policy "geegle_favorites_delete_own" on geegle.favorites
  for delete using (auth.uid() = user_id);

-- 5. Recently played: one row per user per game, refreshed on each play.
create table if not exists geegle.recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  played_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table geegle.recently_played enable row level security;

create policy "geegle_recently_played_select_own" on geegle.recently_played
  for select using (auth.uid() = user_id);
create policy "geegle_recently_played_insert_own" on geegle.recently_played
  for insert with check (auth.uid() = user_id);
create policy "geegle_recently_played_update_own" on geegle.recently_played
  for update using (auth.uid() = user_id);
create policy "geegle_recently_played_delete_own" on geegle.recently_played
  for delete using (auth.uid() = user_id);

-- 6. Game saves: per user, per game, per save slot. Written by the frontend
--    save/restore layer (src/lib/userData.ts) for compatible games.
create table if not exists geegle.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  save_key text not null default 'default',
  save_data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, game_id, save_key)
);

alter table geegle.game_saves enable row level security;

create policy "geegle_game_saves_select_own" on geegle.game_saves
  for select using (auth.uid() = user_id);
create policy "geegle_game_saves_insert_own" on geegle.game_saves
  for insert with check (auth.uid() = user_id);
create policy "geegle_game_saves_update_own" on geegle.game_saves
  for update using (auth.uid() = user_id);
create policy "geegle_game_saves_delete_own" on geegle.game_saves
  for delete using (auth.uid() = user_id);

-- 7. Entry-gate rate limiting. RLS enabled with NO policies: only the Edge
--    Function (service role) can read/write it.
create table if not exists geegle.entry_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean
);

alter table geegle.entry_attempts enable row level security;

create index if not exists entry_attempts_ip_time_idx
  on geegle.entry_attempts (ip_hash, attempted_at desc);

-- 8. Keep updated_at fresh on settings changes.
create or replace function geegle.touch_updated_at()
returns trigger
language plpgsql
set search_path = geegle
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_touch on geegle.user_settings;
create trigger user_settings_touch
  before update on geegle.user_settings
  for each row execute function geegle.touch_updated_at();
