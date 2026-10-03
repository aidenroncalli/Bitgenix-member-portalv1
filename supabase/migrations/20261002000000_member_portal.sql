-- Apply in the connected Supabase project's SQL Editor or with Supabase migrations.
-- Keeps the existing case-sensitive tables/columns; adds only portal requirements.
-- Projects and Queries are shared team resources. Profiles are self-editable;
-- conversations and attachments are visible only to their two participants.
begin;

alter table public."Members"
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists phone text not null default '',
  add column if not exists location text not null default '',
  add column if not exists join_date text,
  add column if not exists specialisations text[] not null default '{}';

alter table public."Projects"
  add column if not exists category text not null default '',
  add column if not exists live_url text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists featured boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public."Messages"
  add column if not exists sender_id uuid references auth.users(id) on delete cascade,
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Existing accounts can be linked by the verified email on their member record.
-- No accounts or sample member records are created automatically.
update public."Members" m
set auth_user_id = u.id
from auth.users u
where m.auth_user_id is null and u.email_confirmed_at is not null
  and lower(m."Email") = lower(u.email);

create unique index if not exists portal_members_auth_user_id on public."Members" (auth_user_id) where auth_user_id is not null;
create index if not exists portal_messages_sender on public."Messages" (sender_id, sent_at);
create index if not exists portal_messages_recipient on public."Messages" (recipient_id, sent_at);

-- A fixed-search-path helper avoids recursive Members RLS checks. It exposes
-- only membership of the current auth.uid(), never member records. Anonymous
-- execution is needed when PostgreSQL plans policies containing this helper;
-- anonymous sessions have a null auth.uid() and therefore return false.
create or replace function public.is_portal_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public."Members" where auth_user_id = (select auth.uid())); $$;
revoke all on function public.is_portal_member() from public;
grant execute on function public.is_portal_member() to anon, authenticated;

alter table public."Members" enable row level security;
alter table public."Projects" enable row level security;
alter table public."Queries" enable row level security;
alter table public."Messages" enable row level security;

-- Restrictive guards also constrain any pre-existing permissive policies.
-- No unrelated existing policies are dropped.
drop policy if exists portal_members_select_guard on public."Members";
create policy portal_members_select_guard on public."Members" as restrictive for select to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_members_read on public."Members";
create policy portal_members_read on public."Members" for select to authenticated using (public.is_portal_member());
drop policy if exists portal_members_update_guard on public."Members";
create policy portal_members_update_guard on public."Members" as restrictive for update to public
using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
drop policy if exists portal_members_edit_self on public."Members";
create policy portal_members_edit_self on public."Members" for update to authenticated
using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));

-- Retain public visibility for published projects on the live website.
drop policy if exists portal_projects_select_guard on public."Projects";
create policy portal_projects_select_guard on public."Projects" as restrictive for select to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() or lower("Status") = 'published' else lower("Status") = 'published' end);
drop policy if exists portal_projects_read on public."Projects";
create policy portal_projects_read on public."Projects" for select to authenticated using (public.is_portal_member());
drop policy if exists portal_projects_published on public."Projects";
create policy portal_projects_published on public."Projects" for select to anon using (lower("Status") = 'published');
drop policy if exists portal_projects_update_guard on public."Projects";
create policy portal_projects_update_guard on public."Projects" as restrictive for update to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() else false end)
with check (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_projects_edit on public."Projects";
create policy portal_projects_edit on public."Projects" for update to authenticated using (public.is_portal_member()) with check (public.is_portal_member());

drop policy if exists portal_queries_select_guard on public."Queries";
create policy portal_queries_select_guard on public."Queries" as restrictive for select to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_queries_read on public."Queries";
create policy portal_queries_read on public."Queries" for select to authenticated using (public.is_portal_member());
drop policy if exists portal_queries_update_guard on public."Queries";
create policy portal_queries_update_guard on public."Queries" as restrictive for update to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() else false end)
with check (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_queries_edit on public."Queries";
create policy portal_queries_edit on public."Queries" for update to authenticated using (public.is_portal_member()) with check (public.is_portal_member());

drop policy if exists portal_messages_select_guard on public."Messages";
create policy portal_messages_select_guard on public."Messages" as restrictive for select to public
using (case when auth.role() = 'authenticated' then public.is_portal_member() and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())) else false end);
drop policy if exists portal_messages_read on public."Messages";
create policy portal_messages_read on public."Messages" for select to authenticated
using (public.is_portal_member() and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));
drop policy if exists portal_messages_insert_guard on public."Messages";
create policy portal_messages_insert_guard on public."Messages" as restrictive for insert to public
with check (case when auth.role() = 'authenticated' then public.is_portal_member() and sender_id = (select auth.uid()) and recipient_id <> sender_id
  and exists (select 1 from public."Members" where auth_user_id = recipient_id)
  and jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5
  and (length(trim(coalesce(text, ''))) > 0 or jsonb_array_length(attachments) > 0) else false end);
drop policy if exists portal_messages_send on public."Messages";
create policy portal_messages_send on public."Messages" for insert to authenticated
with check (sender_id = (select auth.uid()) and public.is_portal_member());

-- Provisioning member records and deleting portal data remain admin-only.
drop policy if exists portal_members_insert_guard on public."Members";
create policy portal_members_insert_guard on public."Members" as restrictive for insert to public with check (false);
drop policy if exists portal_members_delete_guard on public."Members";
create policy portal_members_delete_guard on public."Members" as restrictive for delete to public using (false);
drop policy if exists portal_projects_insert_guard on public."Projects";
create policy portal_projects_insert_guard on public."Projects" as restrictive for insert to public
with check (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_projects_create on public."Projects";
create policy portal_projects_create on public."Projects" for insert to authenticated
with check (public.is_portal_member());
drop policy if exists portal_projects_delete_guard on public."Projects";
create policy portal_projects_delete_guard on public."Projects" as restrictive for delete to public using (false);
drop policy if exists portal_queries_delete_guard on public."Queries";
create policy portal_queries_delete_guard on public."Queries" as restrictive for delete to public using (false);
drop policy if exists portal_messages_update_guard on public."Messages";
create policy portal_messages_update_guard on public."Messages" as restrictive for update to public using (false) with check (false);
drop policy if exists portal_messages_delete_guard on public."Messages";
create policy portal_messages_delete_guard on public."Messages" as restrictive for delete to public using (false);

-- Visitor contact forms may submit pending queries, but cannot read the inbox
-- or claim that an incoming query is already answered/cleared.
drop policy if exists portal_queries_insert_guard on public."Queries";
create policy portal_queries_insert_guard on public."Queries" as restrictive for insert to public
with check (lower(coalesce("Status", 'pending')) = 'pending');
drop policy if exists portal_queries_submit on public."Queries";
create policy portal_queries_submit on public."Queries" for insert to anon, authenticated
with check (lower(coalesce("Status", 'pending')) = 'pending');

-- Column grants prevent profile role/account reassignment by the browser.
grant select on public."Members", public."Queries", public."Messages" to authenticated;
grant select on public."Projects" to anon, authenticated;
revoke update on public."Members", public."Projects", public."Queries" from public, anon, authenticated;
grant update ("Name", "Bio", phone, location, specialisations) on public."Members" to authenticated;
grant update ("Title", "Description", "Image", "Status", category, live_url, tags, featured, updated_at) on public."Projects" to authenticated;
grant insert ("Title", "Description", "Image", "Status", category, live_url, tags, featured, updated_at) on public."Projects" to authenticated;
grant update ("Status") on public."Queries" to authenticated;
grant insert (sender_id, recipient_id, text, sent_at, attachments) on public."Messages" to authenticated;
grant insert ("Name", "Email", "Subject", "Message", "Status") on public."Queries" to anon, authenticated;
-- Remove any old column-level grants that would allow account/role escalation.
revoke update (auth_user_id, "Email", "Role", join_date, id, created_at) on public."Members" from public, anon, authenticated;
-- Grant access only to the Messages sequence, if its existing ID is an identity/serial.
do $$ declare sequence_name text; begin
  sequence_name := pg_get_serial_sequence('public."Messages"', 'id');
  if sequence_name is not null then execute format('grant usage on sequence %s to authenticated', sequence_name); end if;
end $$;
do $$ declare sequence_name text; begin
  sequence_name := pg_get_serial_sequence('public."Projects"', 'id');
  if sequence_name is not null then execute format('grant usage on sequence %s to authenticated', sequence_name); end if;
end $$;
do $$ declare sequence_name text; begin
  sequence_name := pg_get_serial_sequence('public."Queries"', 'id');
  if sequence_name is not null then execute format('grant usage on sequence %s to anon, authenticated', sequence_name); end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-chat', 'portal-chat', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-projects', 'portal-projects', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists portal_projects_media_upload on storage.objects;
create policy portal_projects_media_upload on storage.objects for insert to authenticated
with check (bucket_id = 'portal-projects' and public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists portal_projects_media_cleanup on storage.objects;
create policy portal_projects_media_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'portal-projects' and public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Paths: sender-auth-uuid/recipient-auth-uuid/file-uuid/filename.
drop policy if exists portal_chat_read on storage.objects;
create policy portal_chat_read on storage.objects for select to authenticated
using (bucket_id = 'portal-chat' and public.is_portal_member() and ((storage.foldername(name))[1] = (select auth.uid())::text or (storage.foldername(name))[2] = (select auth.uid())::text));
drop policy if exists portal_chat_upload on storage.objects;
create policy portal_chat_upload on storage.objects for insert to authenticated
with check (bucket_id = 'portal-chat' and public.is_portal_member() and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public."Members" where auth_user_id::text = (storage.foldername(name))[2]));
drop policy if exists portal_chat_cleanup on storage.objects;
create policy portal_chat_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'portal-chat' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Guard this bucket even if the project already has broad storage policies.
-- Other buckets retain their existing behaviour.
drop policy if exists portal_chat_read_guard on storage.objects;
create policy portal_chat_read_guard on storage.objects as restrictive for select to public
using (bucket_id <> 'portal-chat' or case when auth.role() = 'authenticated' then public.is_portal_member()
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (storage.foldername(name))[2] = (select auth.uid())::text) else false end);
drop policy if exists portal_chat_upload_guard on storage.objects;
create policy portal_chat_upload_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'portal-chat' or case when auth.role() = 'authenticated' then public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public."Members" where auth_user_id::text = (storage.foldername(name))[2]) else false end);
drop policy if exists portal_chat_delete_guard on storage.objects;
create policy portal_chat_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'portal-chat' or (auth.role() = 'authenticated' and (storage.foldername(name))[1] = (select auth.uid())::text));
drop policy if exists portal_chat_update_guard on storage.objects;
create policy portal_chat_update_guard on storage.objects as restrictive for update to public
using (bucket_id <> 'portal-chat') with check (bucket_id <> 'portal-chat');
drop policy if exists portal_projects_media_upload_guard on storage.objects;
create policy portal_projects_media_upload_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'portal-projects' or case when auth.role() = 'authenticated' then public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text else false end);
drop policy if exists portal_projects_media_delete_guard on storage.objects;
create policy portal_projects_media_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'portal-projects' or (auth.role() = 'authenticated' and public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text));

-- Realtime is optional; the client also polls for new messages if unavailable.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Messages'
  ) then alter publication supabase_realtime add table public."Messages"; end if;
end $$;

notify pgrst, 'reload schema';
commit;
