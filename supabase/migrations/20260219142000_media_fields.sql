-- Optional media fields for premium salon UI (demo-safe additive migration)
alter table public.salons
  add column if not exists cover_image_url text;

alter table public.salons
  add column if not exists gallery_image_urls text[];

alter table public.staff
  add column if not exists photo_url text;
