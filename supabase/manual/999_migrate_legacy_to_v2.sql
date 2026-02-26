-- Legacy -> V2 migration plan script
-- Assumptions (TODO adjust if your legacy names differ):
--   legacy salons table: public.legacy_salons
--   legacy memberships table: public.legacy_memberships
--
-- Dry-run mode:
--   1) run only SELECT verification blocks first
--   2) wrap writes in a transaction and ROLLBACK
-- Backout:
--   - restore DB backup/snapshot
--   - OR delete rows in salon_members/salons created during migration window using migration marker

create extension if not exists pgcrypto;
create table if not exists public.legacy_salon_id_map (
  legacy_id text primary key,
  salon_id uuid not null references public.salons(id) on delete cascade,
  migrated_at timestamptz not null default now()
);
-- Optional marker table for safe rollback targeting.
create table if not exists public.v2_migration_markers (
  id bigserial primary key,
  entity text not null,
  entity_id text not null,
  created_at timestamptz not null default now()
);
-- ------------------------------------------------------------
-- 1) Migrate salons
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'legacy_salons'
  ) then
    raise notice 'legacy_salons table not found. Skipping salon migration.';
    return;
  end if;

  -- Preserve UUID ids when possible; otherwise generate and map.
  insert into public.salons (
    id,
    slug,
    name,
    whatsapp,
    area,
    timezone,
    status,
    created_at,
    updated_at
  )
  select
    case
      when ls.id ~* '^[0-9a-f-]{36}$' then ls.id::uuid
      else gen_random_uuid()
    end as id,
    coalesce(nullif(ls.slug, ''), lower(regexp_replace(ls.name, '\s+', '-', 'g'))),
    coalesce(nullif(ls.name, ''), 'Legacy Salon'),
    ls.phone,
    coalesce(nullif(ls.area, ''), coalesce(ls.address, 'Unknown')),
    coalesce(nullif(ls.timezone, ''), 'Asia/Baghdad'),
    case lower(coalesce(ls.status, 'draft'))
      when 'active' then 'active'
      when 'pending_review' then 'pending_approval'
      when 'pending_approval' then 'pending_approval'
      when 'suspended' then 'suspended'
      else 'draft'
    end,
    coalesce(ls.created_at, now()),
    coalesce(ls.updated_at, now())
  from public.legacy_salons ls
  on conflict (id) do nothing;

  insert into public.legacy_salon_id_map (legacy_id, salon_id)
  select
    ls.id::text,
    s.id
  from public.legacy_salons ls
  join public.salons s
    on s.slug = coalesce(nullif(ls.slug, ''), lower(regexp_replace(ls.name, '\s+', '-', 'g')))
  on conflict (legacy_id) do update set salon_id = excluded.salon_id;
end $$;
-- ------------------------------------------------------------
-- 2) Migrate memberships
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'legacy_memberships'
  ) then
    raise notice 'legacy_memberships table not found. Skipping membership migration.';
    return;
  end if;

  insert into public.salon_members (salon_id, user_id, role, status, joined_at, removed_at)
  select
    coalesce(map.salon_id, case when lm.salon_id ~* '^[0-9a-f-]{36}$' then lm.salon_id::uuid else null end) as salon_id,
    lm.user_id::uuid as user_id,
    case lower(coalesce(lm.role, 'staff'))
      when 'owner' then 'OWNER'
      when 'admin' then 'MANAGER'
      when 'manager' then 'MANAGER'
      when 'salon_admin' then 'MANAGER'
      else 'STAFF'
    end as role,
    case lower(coalesce(lm.status, 'active'))
      when 'removed' then 'REMOVED'
      when 'inactive' then 'REMOVED'
      else 'ACTIVE'
    end as status,
    coalesce(lm.joined_at, lm.created_at, now()) as joined_at,
    case
      when lower(coalesce(lm.status, 'active')) in ('removed', 'inactive') then coalesce(lm.updated_at, now())
      else null
    end as removed_at
  from public.legacy_memberships lm
  left join public.legacy_salon_id_map map on map.legacy_id = lm.salon_id::text
  where lm.user_id is not null
  on conflict (salon_id, user_id)
  do update
    set role = excluded.role,
        status = excluded.status,
        joined_at = least(public.salon_members.joined_at, excluded.joined_at),
        removed_at = excluded.removed_at;
end $$;
-- ------------------------------------------------------------
-- 3) Verification queries
-- ------------------------------------------------------------

-- Legacy vs V2 salon counts
select
  (select count(*) from public.legacy_salons) as legacy_salons_count,
  (select count(*) from public.salons) as v2_salons_count;
-- Legacy vs V2 membership counts
select
  (select count(*) from public.legacy_memberships) as legacy_memberships_count,
  (select count(*) from public.salon_members) as v2_memberships_count;
-- Orphan V2 memberships (missing salon)
select sm.*
from public.salon_members sm
left join public.salons s on s.id = sm.salon_id
where s.id is null
limit 100;
-- Orphan V2 memberships (missing user)
select sm.*
from public.salon_members sm
left join auth.users u on u.id = sm.user_id
where u.id is null
limit 100;
-- Sample legacy -> V2 salon mapping
select
  map.legacy_id,
  map.salon_id,
  s.slug,
  s.name
from public.legacy_salon_id_map map
join public.salons s on s.id = map.salon_id
order by map.migrated_at desc
limit 50;
-- Sample membership join checks
select
  lm.salon_id as legacy_salon_id,
  lm.user_id as legacy_user_id,
  lm.role as legacy_role,
  lm.status as legacy_status,
  sm.salon_id as v2_salon_id,
  sm.user_id as v2_user_id,
  sm.role as v2_role,
  sm.status as v2_status
from public.legacy_memberships lm
left join public.legacy_salon_id_map map on map.legacy_id = lm.salon_id::text
left join public.salon_members sm
  on sm.salon_id = coalesce(map.salon_id, case when lm.salon_id ~* '^[0-9a-f-]{36}$' then lm.salon_id::uuid else null end)
 and sm.user_id = lm.user_id::uuid
limit 100;
