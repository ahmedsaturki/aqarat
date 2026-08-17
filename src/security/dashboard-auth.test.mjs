import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSupabaseBearerToken, resolveSupabaseDashboardAccess } from './dashboard-auth.mjs';

test('Supabase dashboard access requires a bearer token', async () => {
  assert.equal(hasSupabaseBearerToken({ headers: {} }), false);
  const result = await resolveSupabaseDashboardAccess({ headers: {} });
  assert.deepEqual(result, { ok: false, reason: 'dashboard_auth_required' });
});

test('bearer token is never trusted without verified user and active membership', async () => {
  const req = { headers: { authorization: 'Bearer user-token' } };
  assert.equal(hasSupabaseBearerToken(req), true);
  const denied = await resolveSupabaseDashboardAccess(req, {
    authUser: async token => { assert.equal(token, 'user-token'); return { id: 'user-1' }; },
    membership: async () => ({ auth_user_id: 'user-1', workspace_id: 'workspace-1', role: 'admin', status: 'suspended' }),
  });
  assert.deepEqual(denied, { ok: false, reason: 'dashboard_membership_inactive' });
});

test('active membership resolves to explicit actor and workspace', async () => {
  const req = { headers: { Authorization: 'Bearer verified-token', 'x-dashboard-workspace': 'workspace-1' } };
  const access = await resolveSupabaseDashboardAccess(req, {
    authUser: async token => { assert.equal(token, 'verified-token'); return { id: 'user-1', email_confirmed_at: '2026-08-17T00:00:00Z' }; },
    membership: async (userId, workspaceId) => {
      assert.equal(userId, 'user-1');
      assert.equal(workspaceId, 'workspace-1');
      return { auth_user_id: userId, workspace_id: workspaceId, role: 'operator', status: 'active' };
    },
  });
  assert.equal(access.ok, true);
  assert.equal(access.actorType, 'supabase_auth_user');
  assert.equal(access.actorId, 'user-1');
  assert.equal(access.workspaceId, 'workspace-1');
  assert.equal(access.emailVerified, true);
  assert.equal(access.role, 'operator');
});
