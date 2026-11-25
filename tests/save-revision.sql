-- Run only on a disposable PostgreSQL database as its owner.
\set ON_ERROR_STOP on
begin;

create schema auth;
create role anon;
create role authenticated;
create table auth.users (id uuid primary key, email text not null);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
\ir ../supabase/migrations/0001_init.sql

insert into auth.users values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a-user@users.geegle.internal'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b-user@users.geegle.internal');
insert into public.geegle_game_saves (user_id, game_id, save_data)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clohflip', '{"progress":5}');

\ir ../supabase/migrations/0002_game_save_revision.sql

grant usage on schema public, auth to authenticated;
grant select, insert, update on public.geegle_game_saves to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

do $$
begin
  if exists (select from public.geegle_game_saves) then
    raise exception 'An account could read another account’s save';
  end if;
  update public.geegle_game_saves set save_data = '{}';
  if found then raise exception 'An account could write another account’s save'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
do $$
declare
  original uuid;
  next uuid;
begin
  select revision into strict original from public.geegle_game_saves where save_data = '{"progress":5}';
  update public.geegle_game_saves set save_data = '{"progress":6}' where revision = original returning revision into strict next;
  if next is null or next = original then raise exception 'Save revision did not advance'; end if;
  update public.geegle_game_saves set save_data = '{"progress":0}' where revision = original;
  if found then raise exception 'A stale save revision was accepted'; end if;
  if not exists (select from public.geegle_game_saves where save_data = '{"progress":6}') then
    raise exception 'Stale update changed existing progress';
  end if;
end;
$$;

rollback;
