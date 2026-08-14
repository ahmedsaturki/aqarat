import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewContent } from './policy.mjs';

test('content with provenance and safe claims can pass for owned Telegram', () => {
  const result = reviewContent({ body: 'شقة 120 متر في مدينة السادات', confidence: 0.9, provenanceCount: 1, channel: 'telegram' });
  assert.equal(result.approved, true);
});

test('blocked claims force review', () => {
  const result = reviewContent({ body: 'أفضل سعر ومضمون 100%', confidence: 0.95, provenanceCount: 1, channel: 'telegram' });
  assert.equal(result.approved, false);
  assert.ok(result.blockers.length > 0);
});

test('external channels require human approval', () => {
  const result = reviewContent({ body: 'شقة موثقة المصدر', confidence: 0.9, provenanceCount: 1, channel: 'facebook' });
  assert.equal(result.approved, false);
  assert.equal(result.checks.external_requires_human, true);
});
