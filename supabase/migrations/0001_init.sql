-- Geegle platform schema v1
-- Requires the Supabase Auth schema (auth.users) to exist.

-- 1. Profiles: one row per user, stores the public username.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Only the owner can read/update their own profile.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 2. Profiles index: enforces unique lowercase usernames across the whole app.
--    A profile row is inserted by a trigger when a new auth user is created,
--    using the synthetic email local part as the username.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    lower(split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set username = excluded.username,
        updated_at = now();
  return new;
end;
$$;

-- Sync profile username with email local-part changes (username changes are
-- not currently exposed in the UI, so this is defensive).
create or replace function public.handle_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set username = lower(split_part(new.email, '@', 1)),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

-- 3. Per-user application data: theme, settings, default proxy servers.
create table if not exists public.user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = id);

-- Trigger to create a settings row per new user.
create or replace function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_email_changed on auth.users;
create trigger on_auth_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_email_change();

drop trigger if exists on_auth_user_settings_created on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();

-- 4. Favorites: game ids the user has starred.
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

-- 5. Recently played: one row per user per game, updated on each play.
create table if not exists public.recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  played_at timestamptz not null default now(),
  unique (user_id, game_id)
);

alter table public.recently_played enable row level security;

create policy "recently_played_select_own" on public.recently_played
  for select using (auth.uid() = user_id);
create policy "recently_played_insert_own" on public.recently_played
  for insert with check (auth.uid() = user_id);
create policy "recently_played_update_own" on public.recently_played
  for update using (auth.uid() = user_id);
create policy "recently_played_delete_own" on public.recently_played
  for delete using (auth.uid() = user_id);

-- 6. Game progress / save data: per user, per game, arbitrary JSON blob.
--    Games that save to localStorage on the geegle origin can be migrated
--    into this table on first login (see src/lib/migrateSaves.ts).
create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  save_key text not null default 'default',
  save_data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, game_id, save_key)
);

alter table public.game_saves enable row level security;

create policy "game_saves_select_own" on public.game_saves
  for select using (auth.uid() = user_id);
create policy "game_saves_insert_own" on public.game_saves
  for insert with check (auth.uid() = user_id);
create policy "game_saves_update_own" on public.game_saves
  for update using (auth.uid() = user_id);
create policy "game_saves_delete_own" on public.game_saves
  for delete using (auth.uid() = user_id);

-- 7. Entry-password (site gate) attempt rate limiting.
--    The gate password itself is NOT stored in the database in plaintext;
--    it is checked by an Edge Function using a server-side secret hash.
create table if not exists public.entry_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean
);

alter table public.entry_attempts
  enable row level security;

-- No policies: this table is only accessible from the Edge Function
-- (service role bypasses RLS). Users can never read or write it.

create index if not exists entry_attempts_ip_time_idx
  on public.entry_attempts (ip_hash, attempted_at desc);

-- 8. Updated_at touch function for user_settings.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch
  before update on public.user_settings
  for each row execute function public.touch_updated_at();
