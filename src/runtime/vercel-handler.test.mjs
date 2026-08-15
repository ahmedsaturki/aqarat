import assert from 'node:assert/strict';
import test from 'node:test';
import { handleHealth } from './vercel-handler.mjs';

function responseCapture() {
  const headers = new Map();
  return {
    statusCode: null,
    body: null,
    setHeader(key, value) { headers.set(String(key).toLowerCase(), value); },
    end(body) { this.body = body; },
    headers,
  };
}

test('health response is minimal and never discloses secret configuration state', async () => {
  const response = responseCapture();
  await handleHealth({}, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'aqarat-intake');
  assert.equal(typeof payload.correlation_id, 'string');
  assert.equal('telegram_token_configured' in payload, false);
  assert.equal('intake_secret_configured' in payload, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
