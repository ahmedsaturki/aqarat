import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedInteger } from './runtime-config.mjs';

test('boundedInteger falls back for missing or invalid values', () => {
  delete process.env.TEST_RUNTIME_LIMIT;
  assert.equal(boundedInteger('TEST_RUNTIME_LIMIT', { defaultValue: 15, min: 1, max: 60 }), 15);

  process.env.TEST_RUNTIME_LIMIT = 'not-a-number';
  assert.equal(boundedInteger('TEST_RUNTIME_LIMIT', { defaultValue: 15, min: 1, max: 60 }), 15);
  delete process.env.TEST_RUNTIME_LIMIT;
});

test('boundedInteger truncates and clamps deployment values', () => {
  process.env.TEST_RUNTIME_LIMIT = '99.9';
  assert.equal(boundedInteger('TEST_RUNTIME_LIMIT', { defaultValue: 15, min: 1, max: 60 }), 60);

  process.env.TEST_RUNTIME_LIMIT = '0.5';
  assert.equal(boundedInteger('TEST_RUNTIME_LIMIT', { defaultValue: 15, min: 1, max: 60 }), 1);
  delete process.env.TEST_RUNTIME_LIMIT;
});
