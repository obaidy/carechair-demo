-- Ensure public visibility flag exists for SEO/public web reads.
alter table public.salons
  add column if not exists is_public boolean not null default false;

-- One-time backfill from existing visibility column(s).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salons'
      and column_name = 'is_listed'
  ) then
    execute $sql$
      update public.salons
      set is_public = true
      where coalesce(is_listed, false) = true
    $sql$;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salons'
      and column_name = 'visible_on_explore'
  ) then
    execute $sql$
      update public.salons
      set is_public = true
      where coalesce(visible_on_explore, false) = true
    $sql$;
  end if;
end $$;

create index if not exists salons_is_public_idx on public.salons(is_public);
