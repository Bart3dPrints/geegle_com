-- pgcrypto lives in "extensions" on standard Supabase projects and "public"
-- on some older installations. Restrict the gate RPC to pg_catalog and the
-- actual extension schema. Its table references are already schema-qualified.
do $$
declare crypto_schema name;
begin
  select n.nspname into strict crypto_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  execute pg_catalog.format(
    'alter function public.geegle_verify_entry_password(text,text) set search_path to pg_catalog, %I',
    crypto_schema
  );
end;
$$;
