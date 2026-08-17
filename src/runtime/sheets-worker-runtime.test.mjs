import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.GOOGLE_SHEETS_WEBHOOK_URL = '';
process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = '';

const { processSheetsJobs } = await import('./sheets-worker.mjs?runtime-contract-test');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  };
}

test('requeues expired jobs before claiming and preserves no-job behavior', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/rpc/requeue_expired_jobs')) return response(200, 2);
    if (String(url).includes('/rpc/claim_job')) return response(200, []);
    throw new Error('unexpected_endpoint');
  };
  try {
    assert.deepEqual(await processSheetsJobs(1, 'test-worker'), [{ processed: false, reason: 'no_job' }]);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /rpc\/requeue_expired_jobs$/);
    assert.match(calls[1].url, /rpc\/claim_job$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('continues to claim when expired-job maintenance is unavailable', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/rpc/requeue_expired_jobs')) return response(503, { error: 'maintenance_unavailable' });
    if (String(url).includes('/rpc/claim_job')) return response(200, []);
    throw new Error('unexpected_endpoint');
  };
  try {
    assert.deepEqual(await processSheetsJobs(1, 'test-worker'), [{ processed: false, reason: 'no_job' }]);
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
