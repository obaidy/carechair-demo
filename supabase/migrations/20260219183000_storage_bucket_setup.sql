-- Demo storage setup for salon media uploads
-- NOTE: tighten these policies in production.

insert into storage.buckets (id, name, public)
values ('carechair-media', 'carechair-media', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "demo_media_read" on storage.objects;
create policy "demo_media_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'carechair-media');

drop policy if exists "demo_media_insert" on storage.objects;
create policy "demo_media_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'carechair-media');

drop policy if exists "demo_media_update" on storage.objects;
create policy "demo_media_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'carechair-media')
with check (bucket_id = 'carechair-media');

drop policy if exists "demo_media_delete" on storage.objects;
create policy "demo_media_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'carechair-media');

