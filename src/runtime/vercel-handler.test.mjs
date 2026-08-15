import assert from 'node:assert/strict';
import test from 'node:test';
import { handleHealth, validateIntakeEventContract } from './vercel-handler.mjs';

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

test('validates the direct intake envelope before persistence', () => {
  const valid = validateIntakeEventContract({ channel: 'TELEGRAM', raw_text: 'شقة في مدينة السادات', parsed_payload: { property: {}, validation: { valid: true } } });
  assert.deepEqual(valid, { valid: true, errors: [], channel: 'telegram' });

  const invalid = validateIntakeEventContract({ channel: 'unknown', raw_text: 'x'.repeat(4001), parsed_payload: {} });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('raw_text_too_long'));
  assert.ok(invalid.errors.includes('channel_invalid'));
  assert.ok(invalid.errors.includes('property_payload_required'));
  assert.ok(invalid.errors.includes('validation_payload_required'));
});

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
