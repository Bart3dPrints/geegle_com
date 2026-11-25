create table public.geegle_landing_appearance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  appearance jsonb not null,
  revision uuid not null default gen_random_uuid(),
  constraint geegle_landing_appearance_shape check (
    jsonb_typeof(appearance) = 'object'
    and appearance ?& array['version', 'mode', 'color', 'image']
    and appearance - 'version' - 'mode' - 'color' - 'image' = '{}'::jsonb
    and jsonb_typeof(appearance -> 'version') = 'number'
    and appearance ->> 'version' = '1'
    and jsonb_typeof(appearance -> 'mode') = 'string'
    and appearance ->> 'mode' in ('light', 'dark', 'system')
    and (
      jsonb_typeof(appearance -> 'color') = 'null'
      or (jsonb_typeof(appearance -> 'color') = 'string' and appearance ->> 'color' ~ '^#[[:xdigit:]]{6}$')
    )
    and (
      jsonb_typeof(appearance -> 'image') = 'null'
      or (
        jsonb_typeof(appearance -> 'image') = 'string'
        and char_length(appearance ->> 'image') <= 1000000
        and appearance ->> 'image' ~ '^data:image/(webp|jpeg);base64,([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
        and (appearance ->> 'image' like 'data:image/webp;base64,UklGR%' or appearance ->> 'image' like 'data:image/jpeg;base64,/9j/%')
      )
    )
  )
);

create function public.geegle_rotate_landing_appearance_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := pg_catalog.gen_random_uuid();
  return new;
end;
$$;

create trigger geegle_landing_appearance_revision
  before update on public.geegle_landing_appearance
  for each row execute function public.geegle_rotate_landing_appearance_revision();

alter table public.geegle_landing_appearance enable row level security;

create policy geegle_landing_appearance_select_own
  on public.geegle_landing_appearance for select to authenticated
  using ((select auth.uid()) = user_id);
create policy geegle_landing_appearance_insert_own
  on public.geegle_landing_appearance for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy geegle_landing_appearance_update_own
  on public.geegle_landing_appearance for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.geegle_landing_appearance from public, anon, authenticated;
grant select on public.geegle_landing_appearance to authenticated;
grant insert (user_id, appearance) on public.geegle_landing_appearance to authenticated;
grant update (appearance) on public.geegle_landing_appearance to authenticated;
