do $$
declare
  table_name text;
  sensitive_tables text[] := array[
    'properties',
    'people',
    'leads',
    'interests',
    'interactions',
    'intake_events',
    'jobs',
    'discovery_sources',
    'discovery_runs',
    'discovery_jobs',
    'discovery_evidence',
    'discovery_permission_evidence',
    'review_queue',
    'content_items',
    'content_variants',
    'content_performance',
    'marketing_experiments',
    'publication_jobs',
    'audit_events',
    'sync_projections'
  ];
begin
  foreach table_name in array sensitive_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
      execute format('drop policy if exists deny_direct_%I on public.%I', table_name, table_name);
      execute format(
        'create policy deny_direct_%I on public.%I for all to anon, authenticated using (false) with check (false)',
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;
