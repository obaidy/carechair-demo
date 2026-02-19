-- Minimal image column additions for Supabase Storage URLs
alter table public.salons
  add column if not exists cover_image_url text,
  add column if not exists gallery_image_urls text[];

alter table public.services
  add column if not exists image_url text;

alter table public.staff
  add column if not exists photo_url text;
