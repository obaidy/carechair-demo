create extension if not exists pg_net;

create or replace function public.invoke_dispatch_scheduled_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_url text := current_setting('app.settings.supabase_url', true);
begin
  if coalesce(v_project_url, '') = '' then
    raise warning 'Missing app.settings.supabase_url for dispatch-scheduled-reminders';
    return;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/dispatch-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
end;
$$;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable, schedule dispatch-scheduled-reminders in Supabase dashboard instead.';
    return;
  end;

  if exists (select 1 from cron.job where jobname = 'carechair-dispatch-scheduled-reminders') then
    perform cron.unschedule('carechair-dispatch-scheduled-reminders');
  end if;

  perform cron.schedule(
    'carechair-dispatch-scheduled-reminders',
    '*/10 * * * *',
    $cron$select public.invoke_dispatch_scheduled_reminders();$cron$
  );
exception
  when undefined_table then
    raise notice 'cron.job unavailable, schedule dispatch-scheduled-reminders manually.';
  when others then
    raise notice 'Could not schedule dispatch-scheduled-reminders automatically: %', sqlerrm;
end;
$$;
