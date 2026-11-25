-- Run only on a fresh, disposable PostgreSQL database as its owner.
\set ON_ERROR_STOP on
begin;

create schema auth;
create role anon;
create role authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.geegle_user_settings (user_id uuid primary key, settings jsonb not null);
insert into public.geegle_user_settings values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"unrelated":"keep-me"}');
insert into auth.users values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

\ir ../supabase/migrations/0003_landing_appearance.sql

insert into public.geegle_landing_appearance (user_id, appearance)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '{"version":1,"mode":"dark","color":null,"image":null}'
);

grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated;
grant select, insert, update on public.geegle_user_settings to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.geegle_landing_appearance', 'select')
    or has_table_privilege('anon', 'public.geegle_landing_appearance', 'insert')
    or has_table_privilege('anon', 'public.geegle_landing_appearance', 'update')
    or has_table_privilege('anon', 'public.geegle_landing_appearance', 'delete') then
    raise exception 'anon has access to landing appearance';
  end if;
  if has_table_privilege('authenticated', 'public.geegle_landing_appearance', 'delete') then
    raise exception 'authenticated can delete landing appearance';
  end if;
  if has_column_privilege('authenticated', 'public.geegle_landing_appearance', 'revision', 'insert')
    or has_column_privilege('authenticated', 'public.geegle_landing_appearance', 'revision', 'update')
    or has_column_privilege('authenticated', 'public.geegle_landing_appearance', 'user_id', 'update') then
    raise exception 'authenticated can supply revision or reassign the owner';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

insert into public.geegle_landing_appearance (user_id, appearance)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '{"version":1,"mode":"dark","color":"#123456","image":null}'
);

do $$
declare
  original uuid;
  next_revision uuid;
begin
  select revision into strict original
  from public.geegle_landing_appearance
  where user_id = auth.uid();

  update public.geegle_landing_appearance
  set appearance = '{"version":1,"mode":"light","color":null,"image":null}'
  where user_id = auth.uid() and revision = original
  returning revision into strict next_revision;
  if next_revision is null or next_revision = original then
    raise exception 'landing appearance revision did not rotate';
  end if;

  update public.geegle_landing_appearance
  set appearance = '{"version":1,"mode":"system","color":null,"image":null}'
  where user_id = auth.uid() and revision = original;
  if found then raise exception 'stale revision write was accepted'; end if;
  if not exists (
    select from public.geegle_landing_appearance
    where user_id = auth.uid() and appearance ->> 'mode' = 'light'
  ) then raise exception 'stale write changed appearance'; end if;

  update public.geegle_landing_appearance
  set appearance = '{"version":1,"mode":"light","color":"#aB12fF","image":"data:image/webp;base64,UklGRg=="}'
  where user_id = auth.uid();
  update public.geegle_landing_appearance
  set appearance = '{"version":1,"mode":"light","color":null,"image":"data:image/jpeg;base64,/9j/AA=="}'
  where user_id = auth.uid();

  if exists (select from public.geegle_landing_appearance where user_id <> auth.uid()) then
    raise exception 'owner read another account appearance';
  end if;
  update public.geegle_landing_appearance
  set appearance = '{"version":1,"mode":"dark","color":null,"image":null}'
  where user_id <> auth.uid();
  if found then raise exception 'owner wrote another account appearance'; end if;

  begin
    insert into public.geegle_landing_appearance (user_id, appearance)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"version":1,"mode":"dark","color":null,"image":null}');
    raise exception 'cross-account insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.geegle_landing_appearance (user_id, appearance, revision)
    values (auth.uid(), '{"version":1,"mode":"dark","color":null,"image":null}', gen_random_uuid());
    raise exception 'caller-supplied revision unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.geegle_landing_appearance set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where user_id = auth.uid();
    raise exception 'owner reassignment unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":2,"mode":"dark","color":null,"image":null}'
    where user_id = auth.uid();
    raise exception 'unsupported appearance version unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":1,"mode":"dark","color":null,"image":null,"extra":true}'
    where user_id = auth.uid();
    raise exception 'unknown appearance field unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":1,"mode":"sepia","color":null,"image":null}'
    where user_id = auth.uid();
    raise exception 'invalid mode unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":1,"mode":"dark","color":"#abc","image":null}'
    where user_id = auth.uid();
    raise exception 'invalid color unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":1,"mode":"dark","color":null,"image":"data:image/png;base64,iVBORw0KGgo="}'
    where user_id = auth.uid();
    raise exception 'invalid image format unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = '{"version":1,"mode":"dark","color":null,"image":"data:image/webp;base64,not-base64"}'
    where user_id = auth.uid();
    raise exception 'invalid base64 unexpectedly succeeded';
  exception when check_violation then null;
  end;

  begin
    update public.geegle_landing_appearance
    set appearance = jsonb_build_object(
      'version', 1, 'mode', 'dark', 'color', null,
      'image', 'data:image/webp;base64,UklGR' || repeat('A', 1000000)
    )
    where user_id = auth.uid();
    raise exception 'oversized image unexpectedly succeeded';
  exception when check_violation then null;
  end;

  if not exists (
    select from public.geegle_user_settings
    where user_id = auth.uid() and settings = '{"unrelated":"keep-me"}'
  ) then raise exception 'unrelated user settings were changed'; end if;
end;
$$;

rollback;
