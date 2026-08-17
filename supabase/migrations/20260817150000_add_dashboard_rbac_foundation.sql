create table if not exists public.dashboard_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_permissions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_role_permissions (
  role text not null check (role in ('owner','admin','operator','analyst','viewer')),
  permission_key text not null references public.dashboard_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists public.dashboard_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.dashboard_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','operator','analyst','viewer')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (workspace_id, auth_user_id)
);

create table if not exists public.dashboard_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.dashboard_workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','operator','analyst','viewer')),
  token_digest text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.dashboard_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_members_user_idx on public.dashboard_members(auth_user_id, status);
create index if not exists dashboard_members_workspace_idx on public.dashboard_members(workspace_id, status, role);
create index if not exists dashboard_invitations_lookup_idx on public.dashboard_invitations(workspace_id, email, expires_at);
create index if not exists dashboard_sessions_user_idx on public.dashboard_sessions(auth_user_id, revoked_at, expires_at);

insert into public.dashboard_permissions(permission_key, description) values
  ('dashboard.read.overview', 'قراءة مؤشرات لوحة التشغيل'),
  ('dashboard.read.properties', 'قراءة العقارات'),
  ('dashboard.read.leads', 'قراءة العملاء المحتملين'),
  ('dashboard.read.discovery', 'قراءة مصادر الاكتشاف'),
  ('dashboard.read.content', 'قراءة المحتوى والمراجعة'),
  ('dashboard.read.insights', 'قراءة الرؤى والتحليلات'),
  ('dashboard.read.jobs', 'قراءة العمال والمهام'),
  ('dashboard.read.publications', 'قراءة مهام النشر'),
  ('dashboard.read.audit', 'قراءة سجل التدقيق'),
  ('dashboard.action.review', 'اعتماد أو رفض عناصر المراجعة'),
  ('dashboard.action.jobs', 'إعادة تشغيل المهام'),
  ('dashboard.action.publications', 'إلغاء مهام النشر'),
  ('dashboard.action.discovery', 'تفعيل أو تعطيل مصدر اكتشاف'),
  ('dashboard.action.leads', 'تغيير حالة العميل المحتمل'),
  ('dashboard.manage.members', 'إدارة أعضاء المساحة والدعوات'),
  ('dashboard.manage.roles', 'تعديل الأدوار والصلاحيات'),
  ('dashboard.manage.sessions', 'إبطال جلسات المستخدمين')
on conflict (permission_key) do nothing;

insert into public.dashboard_role_permissions(role, permission_key)
select role, permission_key
from (values
  ('owner','dashboard.read.overview'),('owner','dashboard.read.properties'),('owner','dashboard.read.leads'),('owner','dashboard.read.discovery'),('owner','dashboard.read.content'),('owner','dashboard.read.insights'),('owner','dashboard.read.jobs'),('owner','dashboard.read.publications'),('owner','dashboard.read.audit'),('owner','dashboard.action.review'),('owner','dashboard.action.jobs'),('owner','dashboard.action.publications'),('owner','dashboard.action.discovery'),('owner','dashboard.action.leads'),('owner','dashboard.manage.members'),('owner','dashboard.manage.roles'),('owner','dashboard.manage.sessions'),
  ('admin','dashboard.read.overview'),('admin','dashboard.read.properties'),('admin','dashboard.read.leads'),('admin','dashboard.read.discovery'),('admin','dashboard.read.content'),('admin','dashboard.read.insights'),('admin','dashboard.read.jobs'),('admin','dashboard.read.publications'),('admin','dashboard.read.audit'),('admin','dashboard.action.review'),('admin','dashboard.action.jobs'),('admin','dashboard.action.publications'),('admin','dashboard.action.discovery'),('admin','dashboard.action.leads'),('admin','dashboard.manage.members'),
  ('operator','dashboard.read.overview'),('operator','dashboard.read.properties'),('operator','dashboard.read.leads'),('operator','dashboard.read.discovery'),('operator','dashboard.read.content'),('operator','dashboard.read.jobs'),('operator','dashboard.read.publications'),('operator','dashboard.action.review'),('operator','dashboard.action.jobs'),('operator','dashboard.action.leads'),
  ('analyst','dashboard.read.overview'),('analyst','dashboard.read.properties'),('analyst','dashboard.read.leads'),('analyst','dashboard.read.discovery'),('analyst','dashboard.read.content'),('analyst','dashboard.read.insights'),('analyst','dashboard.read.jobs'),('analyst','dashboard.read.publications'),('analyst','dashboard.read.audit'),
  ('viewer','dashboard.read.overview'),('viewer','dashboard.read.properties'),('viewer','dashboard.read.leads'),('viewer','dashboard.read.discovery'),('viewer','dashboard.read.content'),('viewer','dashboard.read.insights'),('viewer','dashboard.read.jobs'),('viewer','dashboard.read.publications')
) as seeded(role, permission_key)
where exists (select 1 from public.dashboard_permissions p where p.permission_key = seeded.permission_key)
on conflict (role, permission_key) do nothing;

alter table public.dashboard_workspaces enable row level security;
alter table public.dashboard_permissions enable row level security;
alter table public.dashboard_role_permissions enable row level security;
alter table public.dashboard_members enable row level security;
alter table public.dashboard_invitations enable row level security;
alter table public.dashboard_sessions enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['dashboard_workspaces','dashboard_permissions','dashboard_role_permissions','dashboard_members','dashboard_invitations','dashboard_sessions'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = table_name and policyname = 'deny_direct_' || table_name
    ) then
      execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)', 'deny_direct_' || table_name, table_name);
    end if;
  end loop;
end $$;

comment on table public.dashboard_members is 'RBAC membership; application backend uses service_role after authenticating Supabase Auth identity.';
comment on table public.dashboard_invitations is 'Invitation token digests only; raw invitation tokens must never be persisted or logged.';
comment on table public.dashboard_sessions is 'Revocable application session metadata; no raw access tokens are stored.';
