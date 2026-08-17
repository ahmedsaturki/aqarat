import assert from 'node:assert/strict';
import test from 'node:test';
import handler from './[...route].mjs';

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

test('catch-all router serves health with security headers and correlation id', async () => {
  const response = responseCapture();
  await handler({ url: '/api/healthz', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'aqarat-intake');
  assert.equal(typeof payload.correlation_id, 'string');
  assert.equal(response.headers.get('x-correlation-id'), payload.correlation_id);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(String(response.headers.get('x-response-time-ms')), /^\d+(?:\.\d+)?$/);
  assert.match(String(response.headers.get('server-timing')), /^aqarat;dur=\d+(?:\.\d+)?$/);
});

test('catch-all router preserves a valid caller correlation id', async () => {
  const response = responseCapture();
  await handler({ url: '/api/healthz', headers: { 'x-correlation-id': 'test-correlation-01' } }, response);

  const payload = JSON.parse(response.body);
  assert.equal(payload.correlation_id, 'test-correlation-01');
  assert.equal(response.headers.get('x-correlation-id'), 'test-correlation-01');
});

test('catch-all router rejects unallowlisted routes without loading arbitrary modules', async () => {
  const response = responseCapture();
  await handler({ url: '/api/not-allowlisted', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(payload, {
    ok: false,
    error: 'route_not_found',
    correlation_id: payload.correlation_id,
  });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('catch-all router does not let query route override a real API pathname', async () => {
  const response = responseCapture();
  await handler({ url: '/api/healthz?route=dashboard/data', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'aqarat-intake');
});

test('catch-all router preserves internal Vercel rewrite route selection', async () => {
  const response = responseCapture();
  await handler({ url: '/api/route?route=healthz', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'aqarat-intake');
});

test('catch-all router accepts only the route mapped to a rewritten source pathname', async () => {
  const response = responseCapture();
  await handler({ url: '/healthz?route=healthz', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'aqarat-intake');
});

test('catch-all router rejects a mismatched rewrite route instead of loading another handler', async () => {
  const response = responseCapture();
  await handler({ url: '/healthz?route=dashboard/data', headers: {} }, response);

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 404);
  assert.equal(payload.error, 'route_not_found');
});
