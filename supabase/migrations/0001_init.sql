-- Geegle platform schema v2. IMPORTANT: all tables live in the PUBLIC schema
-- with a geegle_ prefix. Custom schemas (e.g. `geegle`) are NOT exposed
-- through Supabase's Data API by default, which would break every query from
-- the deployed site. The public schema is always exposed; the prefix keeps
-- these tables separate from other applications in the same project.

create extension if not exists pgcrypto;

-- 1. Profiles: one row per auth user, public username.
create table if not exists public.geegle_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.geegle_profiles enable row level security;
create policy "geegle_profiles_select_own" on public.geegle_profiles
  for select using (auth.uid() = id);
create policy "geegle_profiles_update_own" on public.geegle_profiles
  for update using (auth.uid() = id);

-- 2. Per-user settings: theme + preferences JSON (default proxy servers).
create table if not exists public.geegle_user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.geegle_user_settings enable row level security;
create policy "geegle_settings_select_own" on public.geegle_user_settings
  for select using (auth.uid() = id);
create policy "geegle_settings_insert_own" on public.geegle_user_settings
  for insert with check (auth.uid() = id);
create policy "geegle_settings_update_own" on public.geegle_user_settings
  for update using (auth.uid() = id);

-- 3. Favorites.
create table if not exists public.geegle_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, game_id)
);
alter table public.geegle_favorites enable row level security;
create policy "geegle_fav_select_own" on public.geegle_favorites
  for select using (auth.uid() = user_id);
create policy "geegle_fav_insert_own" on public.geegle_favorites
  for insert with check (auth.uid() = user_id);
create policy "geegle_fav_delete_own" on public.geegle_favorites
  for delete using (auth.uid() = user_id);

-- 4. Recently played: one row per user per game, refreshed on each play.
create table if not exists public.geegle_recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  played_at timestamptz not null default now(),
  unique (user_id, game_id)
);
alter table public.geegle_recently_played enable row level security;
create policy "geegle_recent_select_own" on public.geegle_recently_played
  for select using (auth.uid() = user_id);
create policy "geegle_recent_insert_own" on public.geegle_recently_played
  for insert with check (auth.uid() = user_id);
create policy "geegle_recent_update_own" on public.geegle_recently_played
  for update using (auth.uid() = user_id);
create policy "geegle_recent_delete_own" on public.geegle_recently_played
  for delete using (auth.uid() = user_id);

-- 5. Game saves: cloud-save payloads written by src/lib/cloudSaves.ts.
create table if not exists public.geegle_game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  save_key text not null default 'default',
  save_data jsonb not null,
  updated_at timestamptz not null now(),
  created_at timestamptz not null default now(),
  unique (user_id, game_id, save_key)
);
alter table public.geegle_game_saves enable row level security;
create policy "geegle_saves_select_own" on public.geegle_game_saves
  for select using (auth.uid() = user_id);
create policy "geegle_saves_insert_own" on public.geegle_game_saves
  for insert with check (auth.uid() = user_id);
create policy "geegle_saves_update_own" on public.geegle_game_saves
  for update using (auth.uid() = user_id);
create policy "geegle_saves_delete_own" on public.geegle_game_saves
  for delete using (auth.uid() = user_id);

-- 6. Entry-gate rate limiting. RLS with NO policies: only the verify function
--    (security definer) can read/write it.
create table if not exists public.geegle_entry_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean
);
alter table public.geegle_entry_attempts enable row level security;
create index if not exists geegle_entry_attempts_idx
  on public.geegle_entry_attempts (ip_hash, attempted_at desc);

-- 7. Entry-gate config: bcrypt hash of the shared site password. RLS with NO
--    policies so the hash is unreadable to clients; the security-definer
--    verify function is the only reader. To change the site password:
--      update public.geegle_entry_config
--      set password_hash = crypt('<new-password>', gen_salt('bf', 12))
--      where id = 1;
create table if not exists public.geegle_entry_config (
  id int primary key check (id = 1),
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.geegle_entry_config enable row level security;

insert into public.geegle_entry_config (id, password_hash)
values (1, crypt('pirate', gen_salt('bf', 12)))
on conflict (id) do nothing;

-- 8. Entry-gate verification RPC: callable WITHOUT authentication (the gate
--    runs before sign-in). Bcrypt check + per-IP rate limiting (10 failures
--    per 10 minutes) server-side.
create or replace function public.geegle_verify_entry_password(p_password text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_ip_hash text;
  v_failures int;
  v_valid boolean;
begin
  select password_hash into v_hash from public.geegle_entry_config where id = 1;
  if v_hash is null then
    return jsonb_build_object('valid', false, 'reason', 'gate_not_configured');
  end if;

  v_ip_hash := encode(digest(v_hash || coalesce(p_ip, 'unknown'), 'sha256'), 'hex');

  select count(*) into v_failures
  from public.geegle_entry_attempts
  where ip_hash = v_ip_hash
    and success = false
    and attempted_at > now() - interval '10 minutes';

  if v_failures >= 10 then
    return jsonb_build_object('valid', false, 'reason', 'rate_limited');
  end if;

  v_valid := crypt(p_password, v_hash) = v_hash;

  insert into public.geegle_entry_attempts (ip_hash, success)
  values (v_ip_hash, v_valid);

  delete from public.geegle_entry_attempts
  where attempted_at < now() - interval '24 hours';

  return jsonb_build_object('valid', v_valid);
end;
$$;
grant execute on function public.geegle_verify_entry_password(text, text) to anon, authenticated;

-- 9. Signup trigger: provisions profile + settings for Geegle's synthetic
--    emails only (does not touch other applications' users).
create or replace function public.geegle_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email like '%@users.geegle.internal' then
    insert into public.geegle_profiles (id, username)
    values (new.id, lower(split_part(new.email, '@', 1)))
    on conflict (id) do update
      set username = excluded.username, updated_at = now();
    insert into public.geegle_user_settings (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists geegle_on_auth_user_created on auth.users;
create trigger geegle_on_auth_user_created
  after insert on auth.users
  for each row execute function public.geegle_handle_new_user();

-- 10. Keep updated_at fresh.
create or replace function public.geegle_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists geegle_settings_touch on public.geegle_user_settings;
create trigger geegle_settings_touch
  before update on public.geegle_user_settings
  for each row execute function public.geegle_touch_updated_at();
