import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardAuthMode, resolveDashboardAccess } from './dashboard-access.mjs';

test('dashboard auth defaults to legacy compatibility mode', async () => {
  const previous = process.env.DASHBOARD_AUTH_MODE;
  delete process.env.DASHBOARD_AUTH_MODE;
  try {
    assert.equal(dashboardAuthMode(), 'legacy');
    const access = await resolveDashboardAccess({ headers: {} });
    assert.equal(access.ok, false);
    assert.equal(access.reason, 'dashboard_auth_required');
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_AUTH_MODE;
    else process.env.DASHBOARD_AUTH_MODE = previous;
  }
});

test('supabase mode does not fall back to legacy sessions', async () => {
  const access = await resolveDashboardAccess({ headers: {} }, {
    mode: 'supabase',
    authUser: async () => null,
  });
  assert.deepEqual(access, { ok: false, reason: 'dashboard_auth_required' });
});

test('unknown auth mode fails closed', async () => {
  assert.equal(dashboardAuthMode({ mode: 'unexpected' }), 'unexpected');
  assert.deepEqual(await resolveDashboardAccess({ headers: {} }, { mode: 'unexpected' }), { ok: false, reason: 'dashboard_auth_mode_invalid' });
});
