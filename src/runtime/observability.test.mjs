import test from 'node:test';
import assert from 'node:assert/strict';
import { safeErrorMessage } from './observability.mjs';

test('safeErrorMessage redacts credentials and bounds error text', () => {
  const raw = 'GET /callback?token=super-secret&password=hidden Authorization: Bearer abc.def-ghi user@example.com';
  const safe = safeErrorMessage(raw);
  assert.equal(safe.includes('super-secret'), false);
  assert.equal(safe.includes('hidden'), false);
  assert.equal(safe.includes('abc.def-ghi'), false);
  assert.equal(safe.includes('user@example.com'), false);
  assert.match(safe, /\[REDACTED\]/);
  assert.match(safe, /\[EMAIL_REDACTED\]/);
});

test('safeErrorMessage truncates untrusted provider messages', () => {
  assert.equal(safeErrorMessage('x'.repeat(600)).length, 512);
});
