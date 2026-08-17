import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.DASHBOARD_ADMIN_SECRET = 'test-dashboard-secret';

const { default: login } = await import('./login.mjs?dashboard-data-test-login');
const { default: dashboardData, normalizeDashboardSearch } = await import('./data.mjs?dashboard-data-test-data');

async function dashboardCookie() {
  const response = {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); },
    json(payload) { this.payload = payload; },
    status(code) { this.statusCode = code; return this; },
  };
  await login({ method: 'POST', body: { password: 'test-dashboard-secret' } }, response);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function responseCapture() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; },
  };
}

test('normalizes dashboard search input and bounds its length', () => {
  assert.equal(normalizeDashboardSearch('  مدينة   نصر  '), 'مدينة نصر');
  assert.equal(normalizeDashboardSearch('hello&or=(secret)<>'), 'hello or secret');
  assert.equal(normalizeDashboardSearch('x'.repeat(200)).length, 80);
});

test('returns a bounded dashboard page with navigation metadata', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, async json() { return [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }]; } };
  };
  try {
    const response = responseCapture();
    await dashboardData({
      method: 'GET',
      query: { view: 'properties', limit: '2', offset: '4' },
      headers: { cookie: await dashboardCookie() },
      aqaratCorrelationId: 'dashboard-correlation-1',
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload.properties, [{ id: 'row-1' }, { id: 'row-2' }]);
    assert.deepEqual(response.payload.pagination.properties, { limit: 2, offset: 4, returned: 2, has_more: true, next_offset: 6 });
    assert.equal(response.payload.correlation_id, 'dashboard-correlation-1');
    assert.match(calls[0], /limit=3&offset=4/);

    const searched = responseCapture();
    await dashboardData({
      method: 'GET',
      query: { view: 'properties', q: 'مدينة نصر' },
      headers: { cookie: await dashboardCookie() },
      aqaratCorrelationId: 'dashboard-search-1',
    }, searched);
    assert.equal(searched.statusCode, 200);
    assert.equal(searched.payload.search, 'مدينة نصر');
    assert.match(calls.at(-1), /or=\(title\.ilike\.[^&]+,city\.ilike\./);
  } finally {
    global.fetch = originalFetch;
  }
});

test('audit view requests safe explorer fields without internal state snapshots', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, async json() { return [{ id: 'audit-1', event_type: 'dashboard_action', reason: 'reviewed' }]; } };
  };
  try {
    const response = responseCapture();
    await dashboardData({
      method: 'GET',
      query: { view: 'audit', limit: '10' },
      headers: { cookie: await dashboardCookie() },
      aqaratCorrelationId: 'dashboard-audit-1',
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload.audit_events, [{ id: 'audit-1', event_type: 'dashboard_action', reason: 'reviewed' }]);
    assert.match(calls[0], /select=id,event_type,entity_type,entity_id,actor_type,actor_id,correlation_id,reason,payload,created_at/);
    assert.equal(calls[0].includes('before_state'), false);
    assert.equal(calls[0].includes('after_state'), false);

    const searched = responseCapture();
    await dashboardData({
      method: 'GET',
      query: { view: 'audit', q: 'dashboard_action' },
      headers: { cookie: await dashboardCookie() },
      aqaratCorrelationId: 'dashboard-audit-search-1',
    }, searched);
    assert.equal(searched.statusCode, 200);
    assert.match(calls.at(-1), /or=\(event_type\.ilike\.\*dashboard_action\*/);
    assert.equal(calls.at(-1).includes('before_state'), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns a retryable correlated error without upstream details', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503, async json() { return { secret: 'must-not-leak' }; } });
  try {
    const response = responseCapture();
    await dashboardData({
      method: 'GET',
      query: { view: 'properties' },
      headers: { cookie: await dashboardCookie() },
      aqaratCorrelationId: 'dashboard-correlation-2',
    }, response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.payload, {
      error: 'dashboard_data_failed',
      retryable: true,
      correlation_id: 'dashboard-correlation-2',
    });
    assert.equal(JSON.stringify(response.payload).includes('must-not-leak'), false);
  } finally {
    global.fetch = originalFetch;
  }
});
