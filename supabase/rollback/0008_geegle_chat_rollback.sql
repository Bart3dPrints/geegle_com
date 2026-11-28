-- Rollback for 0008_geegle_chat.sql (production project oizdbkxnzwatytxcrvoo).
--
-- Scope: drops ONLY the objects created by 0008 — the six chat tables, their
-- functions, the private background bucket and its storage policies, and the
-- Realtime publication entries. No other application's table, no auth user and
-- no game save is touched.
--
-- Dropping the tables deletes the chat history they hold; nothing outside
-- Geegle chat is affected.

begin;

-- 1. Stop streaming first, so Realtime cannot hold a lock on the tables.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.geegle_messages;
    exception when undefined_object then null;
    end;
    begin
      alter publication supabase_realtime drop table public.geegle_conversations;
    exception when undefined_object then null;
    end;
    begin
      alter publication supabase_realtime drop table public.geegle_conversation_members;
    exception when undefined_object then null;
    end;
  end if;
end;
$$;

-- 2. Functions (by signature; `if exists` tolerates a partial run).
drop function if exists public.geegle_chat_members(uuid);
drop function if exists public.geegle_chat_background(uuid);
drop function if exists public.geegle_chat_set_background(uuid, text, text, text, integer);
drop function if exists public.geegle_chat_forward(uuid, uuid);
drop function if exists public.geegle_chat_mark_read(uuid);
drop function if exists public.geegle_chat_report(uuid, text);
drop function if exists public.geegle_chat_hide(uuid);
drop function if exists public.geegle_chat_unsend(uuid);
drop function if exists public.geegle_chat_edit(uuid, text);
drop function if exists public.geegle_chat_send(uuid, text);
drop function if exists public.geegle_chat_messages(uuid, timestamptz, uuid, integer);
drop function if exists public.geegle_chat_transfer_ownership(uuid, uuid);
drop function if exists public.geegle_chat_leave_group(uuid);
drop function if exists public.geegle_chat_invite(uuid, uuid);
drop function if exists public.geegle_chat_rename_group(uuid, text);
drop function if exists public.geegle_chat_create_group(text);
drop function if exists public.geegle_chat_open_dm(uuid);
drop function if exists public.geegle_chat_overview();
drop function if exists public.geegle_is_conversation_member(uuid);
drop function if exists public.geegle_can_read(uuid);

-- 3. Private bucket and its policies.
do $$
begin
  if to_regclass('storage.objects') is not null then
    begin
      drop policy if exists geegle_chat_bg_select on storage.objects;
      drop policy if exists geegle_chat_bg_insert on storage.objects;
      drop policy if exists geegle_chat_bg_update on storage.objects;
      drop policy if exists geegle_chat_bg_delete on storage.objects;
    exception when insufficient_privilege then null;
    end;
  end if;
  if to_regclass('storage.buckets') is not null then
    begin
      delete from storage.objects where bucket_id = 'geegle-chat-backgrounds';
      delete from storage.buckets where id = 'geegle-chat-backgrounds';
    exception when insufficient_privilege then null;
    end;
  end if;
end;
$$;

-- 4. Tables (policies and indexes belong to them and go with them).
drop table if exists public.geegle_message_reports;
drop table if exists public.geegle_message_hidden;
drop table if exists public.geegle_dm_backgrounds;
drop table if exists public.geegle_messages;
drop table if exists public.geegle_conversation_members;
drop table if exists public.geegle_conversations;

commit;

-- Verification after a rollback: must return zero rows.
--   select table_name from information_schema.tables
--    where table_schema = 'public' and table_name like 'geegle\_chat%' escape '\';
