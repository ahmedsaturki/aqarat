do $$
declare r record; policy_name text;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  loop
    policy_name := 'deny_direct_' || r.table_name;
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=r.table_name and policyname=policy_name
    ) then
      execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', policy_name, r.table_name);
    end if;
  end loop;
end $$;
drop index if exists public.sync_projections_entity_projection_uq;
