insert into public.dashboard_permissions(permission_key, description)
values ('dashboard.action.properties', 'إنشاء وتعديل وأرشفة العقارات')
on conflict (permission_key) do nothing;

insert into public.dashboard_role_permissions(role, permission_key)
select seeded.role, 'dashboard.action.properties'
from (values ('owner'), ('admin'), ('operator')) as seeded(role)
where exists (select 1 from public.dashboard_permissions where permission_key = 'dashboard.action.properties')
on conflict (role, permission_key) do nothing;

comment on table public.dashboard_role_permissions is 'Explicit role-to-permission catalog; property mutations require dashboard.action.properties.';
