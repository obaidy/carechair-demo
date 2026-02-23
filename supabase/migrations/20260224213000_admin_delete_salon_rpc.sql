-- Secure superadmin salon deletion RPC.
-- Fixes UI-only deletion when direct anon delete is blocked by RLS/policies.

create extension if not exists pgcrypto;

create or replace function public._verify_superadmin_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  expected := coalesce(nullif(current_setting('app.settings.superadmin_code', true), ''), '1989');
  return coalesce(p_code, '') = expected;
end;
$$;

create or replace function public.admin_delete_salon(
  p_admin_code text,
  p_salon_id uuid,
  p_admin_user_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  delete from public.salons
  where id = p_salon_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception using errcode = 'P0002', message = 'salon_not_found_or_not_deleted';
  end if;

  begin
    perform public.admin_actions_write(
      p_admin_code,
      coalesce(p_admin_user_id, gen_random_uuid()),
      p_salon_id,
      'delete_salon',
      coalesce(p_payload, '{}'::jsonb)
    );
  exception when others then
    -- Do not fail deletion if audit logging fails.
    null;
  end;

  return jsonb_build_object('ok', true, 'salon_id', v_deleted_id);
end;
$$;

grant execute on function public.admin_delete_salon(text, uuid, uuid, jsonb) to anon, authenticated;
