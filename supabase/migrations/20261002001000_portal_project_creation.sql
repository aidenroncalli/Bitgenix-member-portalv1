-- Adds member-created projects and public project imagery. This follow-up is
-- intentionally idempotent in case the base member portal migration ran first.
begin;

drop policy if exists portal_projects_insert_guard on public."Projects";
create policy portal_projects_insert_guard on public."Projects" as restrictive for insert to public
with check (case when auth.role() = 'authenticated' then public.is_portal_member() else false end);
drop policy if exists portal_projects_create on public."Projects";
create policy portal_projects_create on public."Projects" for insert to authenticated
with check (public.is_portal_member());

grant insert ("Title", "Description", "Image", "Status", category, live_url, tags, featured, updated_at)
on public."Projects" to authenticated;

do $$ declare sequence_name text; begin
  sequence_name := pg_get_serial_sequence('public."Projects"', 'id');
  if sequence_name is not null then execute format('grant usage on sequence %s to authenticated', sequence_name); end if;
end $$;

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

-- Restrictive guards keep pre-existing broad storage policies from granting
-- non-members access to write or delete project media.
drop policy if exists portal_projects_media_upload_guard on storage.objects;
create policy portal_projects_media_upload_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'portal-projects' or case when auth.role() = 'authenticated' then public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text else false end);
drop policy if exists portal_projects_media_delete_guard on storage.objects;
create policy portal_projects_media_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'portal-projects' or (auth.role() = 'authenticated' and public.is_portal_member()
  and (storage.foldername(name))[1] = (select auth.uid())::text));

notify pgrst, 'reload schema';
commit;
