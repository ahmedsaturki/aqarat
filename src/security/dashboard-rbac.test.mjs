import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_ROLES,
  dashboardPermissionsForRole,
  hasDashboardPermission,
  requireDashboardPermission,
  resolveDashboardMemberAccess,
  resolveLegacyDashboardAccess,
} from './dashboard-rbac.mjs';

test('RBAC exposes the five documented roles', () => {
  assert.deepEqual([...DASHBOARD_ROLES].sort(), ['admin', 'analyst', 'operator', 'owner', 'viewer']);
});

test('viewer has read access but no operational write access', () => {
  assert.equal(hasDashboardPermission('viewer', 'dashboard.read.properties'), true);
  assert.equal(hasDashboardPermission('viewer', 'dashboard.action.jobs'), false);
  assert.equal(hasDashboardPermission('viewer', 'dashboard.manage.members'), false);
});

test('analyst can read audit and insights but cannot mutate leads', () => {
  assert.equal(hasDashboardPermission('analyst', 'dashboard.read.audit'), true);
  assert.equal(hasDashboardPermission('analyst', 'dashboard.read.insights'), true);
  assert.equal(hasDashboardPermission('analyst', 'dashboard.action.leads'), false);
});

test('inactive or incomplete membership is denied', () => {
  assert.equal(resolveDashboardMemberAccess({ role: 'admin', status: 'suspended', auth_user_id: 'u1', workspace_id: 'w1' }).ok, false);
  assert.equal(resolveDashboardMemberAccess({ role: 'admin', status: 'active', auth_user_id: '', workspace_id: 'w1' }).ok, false);
  assert.equal(resolveDashboardMemberAccess({ role: 'unknown', status: 'active', auth_user_id: 'u1', workspace_id: 'w1' }).ok, false);
});

test('active membership resolves to explicit actor and permission set', () => {
  const access = resolveDashboardMemberAccess({ role: 'operator', status: 'active', auth_user_id: 'u1', workspace_id: 'w1' });
  assert.equal(access.ok, true);
  assert.equal(access.actorType, 'supabase_auth_user');
  assert.equal(access.actorId, 'u1');
  assert.equal(access.workspaceId, 'w1');
  assert.equal(access.role, 'operator');
  assert.equal(access.permissions.includes('dashboard.action.jobs'), true);
  assert.equal(access.permissions.includes('dashboard.manage.roles'), false);
});

test('permission guard denies missing access and allows explicit permission only', () => {
  assert.equal(requireDashboardPermission(null, 'dashboard.read.overview').reason, 'dashboard_auth_required');
  const access = resolveDashboardMemberAccess({ role: 'operator', status: 'active', auth_user_id: 'u1', workspace_id: 'w1' });
  assert.equal(requireDashboardPermission(access, 'dashboard.action.jobs').ok, true);
  assert.equal(requireDashboardPermission(access, 'dashboard.action.publications').ok, false);
});

test('legacy access is explicitly owner-scoped and marked for migration', () => {
  const access = resolveLegacyDashboardAccess('dashboard-session:abc');
  assert.equal(access.ok, true);
  assert.equal(access.legacy, true);
  assert.equal(access.actorType, 'dashboard_session_legacy');
  assert.equal(access.role, 'owner');
  assert.deepEqual(access.permissions, dashboardPermissionsForRole('owner'));
  assert.equal(resolveLegacyDashboardAccess('').ok, false);
});
