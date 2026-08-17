import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './public-config.mjs';

function responseDouble() {
  const response = {
    statusCode: null,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  return response;
}

test('public-config exposes only the intentional public contract', () => {
  const response = responseDouble();
  handler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.body).sort(), [
    'brand',
    'phone',
    'public_price_policy',
    'website',
    'whatsapp',
  ]);
  assert.equal(response.body.public_price_policy, 'never_publish_internal_price');
  assert.equal('SUPABASE_SERVICE_ROLE_KEY' in response.body, false);
  assert.equal('GEMINI_API_KEY' in response.body, false);
});

test('public-config rejects non-GET methods with an explicit allow header', () => {
  const response = responseDouble();
  handler({ method: 'POST' }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET');
  assert.deepEqual(response.body, { error: 'method_not_allowed' });
});
