const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze([
    'dashboard.read.overview', 'dashboard.read.properties', 'dashboard.read.leads', 'dashboard.read.discovery',
    'dashboard.read.content', 'dashboard.read.insights', 'dashboard.read.jobs', 'dashboard.read.publications',
    'dashboard.read.audit', 'dashboard.action.review', 'dashboard.action.jobs', 'dashboard.action.publications',
    'dashboard.action.discovery', 'dashboard.action.leads', 'dashboard.manage.members', 'dashboard.manage.roles',
    'dashboard.manage.sessions',
  ]),
  admin: Object.freeze([
    'dashboard.read.overview', 'dashboard.read.properties', 'dashboard.read.leads', 'dashboard.read.discovery',
    'dashboard.read.content', 'dashboard.read.insights', 'dashboard.read.jobs', 'dashboard.read.publications',
    'dashboard.read.audit', 'dashboard.action.review', 'dashboard.action.jobs', 'dashboard.action.publications',
    'dashboard.action.discovery', 'dashboard.action.leads', 'dashboard.manage.members',
  ]),
  operator: Object.freeze([
    'dashboard.read.overview', 'dashboard.read.properties', 'dashboard.read.leads', 'dashboard.read.discovery',
    'dashboard.read.content', 'dashboard.read.jobs', 'dashboard.read.publications', 'dashboard.action.review',
    'dashboard.action.jobs', 'dashboard.action.leads',
  ]),
  analyst: Object.freeze([
    'dashboard.read.overview', 'dashboard.read.properties', 'dashboard.read.leads', 'dashboard.read.discovery',
    'dashboard.read.content', 'dashboard.read.insights', 'dashboard.read.jobs', 'dashboard.read.publications',
    'dashboard.read.audit',
  ]),
  viewer: Object.freeze([
    'dashboard.read.overview', 'dashboard.read.properties', 'dashboard.read.leads', 'dashboard.read.discovery',
    'dashboard.read.content', 'dashboard.read.insights', 'dashboard.read.jobs', 'dashboard.read.publications',
  ]),
});

const ROLES = new Set(Object.keys(ROLE_PERMISSIONS));
const ACTIVE_STATUSES = new Set(['active']);

export function normalizeDashboardRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ROLES.has(role) ? role : null;
}

export function dashboardPermissionsForRole(role) {
  const normalized = normalizeDashboardRole(role);
  return normalized ? [...ROLE_PERMISSIONS[normalized]] : [];
}

export function hasDashboardPermission(role, permission) {
  const normalized = normalizeDashboardRole(role);
  return Boolean(normalized && ROLE_PERMISSIONS[normalized].includes(String(permission || '').trim()));
}

export function resolveDashboardMemberAccess(member) {
  const role = normalizeDashboardRole(member?.role);
  const status = String(member?.status || '').trim().toLowerCase();
  const userId = String(member?.auth_user_id || '').trim();
  const workspaceId = String(member?.workspace_id || '').trim();
  if (!role || !ACTIVE_STATUSES.has(status) || !userId || !workspaceId) {
    return { ok: false, reason: 'dashboard_membership_inactive' };
  }
  return {
    ok: true,
    actorType: 'supabase_auth_user',
    actorId: userId,
    workspaceId,
    role,
    permissions: dashboardPermissionsForRole(role),
  };
}

export function resolveLegacyDashboardAccess(actorId) {
  const normalized = String(actorId || '').trim();
  if (!normalized) return { ok: false, reason: 'dashboard_auth_required' };
  return {
    ok: true,
    actorType: 'dashboard_session_legacy',
    actorId: normalized,
    workspaceId: null,
    role: 'owner',
    legacy: true,
    permissions: dashboardPermissionsForRole('owner'),
  };
}

export function requireDashboardPermission(access, permission) {
  if (!access?.ok) return { ok: false, reason: access?.reason || 'dashboard_auth_required' };
  return hasDashboardPermission(access.role, permission)
    ? { ok: true, access }
    : { ok: false, reason: 'dashboard_permission_required', permission: String(permission || '') };
}

export const DASHBOARD_ROLES = Object.freeze([...ROLES]);
