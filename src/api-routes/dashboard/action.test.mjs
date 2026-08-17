import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.DASHBOARD_ADMIN_SECRET = 'test-dashboard-secret';
process.env.PUBLIC_BASE_URL = 'https://aqarat.test';

const { default: login } = await import('./login.mjs?action-test-login');
const { default: action } = await import('./action.mjs?action-test-action');

async function dashboardCookie() {
  const response = {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); },
    json(payload) { this.payload = payload; },
    status(code) { this.statusCode = code; return this; },
  };
  await login({ method: 'POST', headers: { origin: 'https://aqarat.test' }, body: { password: 'test-dashboard-secret' } }, response);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function responseCapture() {
  return {
    statusCode: null,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; },
  };
}

test('redacts and bounds dashboard action error telemetry', async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  const logs = [];
  global.fetch = async () => {
    throw new Error(`rpc failed https://provider.test/?token=action-secret operator@example.com ${'y'.repeat(700)}`);
  };
  console.error = (line) => logs.push(String(line));
  try {
    const response = responseCapture();
    await action({
      method: 'POST',
      headers: { origin: 'https://aqarat.test', cookie: await dashboardCookie() },
      body: { action: 'job_retry', id: 'job-1' },
    }, response);
    assert.equal(response.statusCode, 500);
    const event = JSON.parse(logs.at(-1));
    assert.equal(event.event, 'dashboard_action_error');
    assert.equal(event.error.includes('action-secret'), false);
    assert.equal(event.error.includes('operator@example.com'), false);
    assert.ok(event.error.length <= 512);
  } finally {
    console.error = originalError;
    global.fetch = originalFetch;
  }
});

