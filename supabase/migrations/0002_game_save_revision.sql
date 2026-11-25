-- Each write gets a new revision, including writes from older clients.
alter table public.geegle_game_saves
  add column if not exists revision uuid not null default gen_random_uuid();

create or replace function public.geegle_revision_game_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := pg_catalog.gen_random_uuid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists geegle_game_saves_revision on public.geegle_game_saves;
create trigger geegle_game_saves_revision
  before update on public.geegle_game_saves
  for each row execute function public.geegle_revision_game_save();
