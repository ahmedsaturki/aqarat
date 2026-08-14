import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead } from './lead-scorer.mjs';

test('hot lead when strong local and explicit intent signals exist', () => {
  const result = scoreLead({
    has_contact: true,
    explicit_intent_score: 1,
    property_interest_score: 0.9,
    sadat_city_score: 1,
    recency_score: 1,
  });
  assert.equal(result.tier, 'hot');
  assert.ok(result.score >= 0.8);
});

test('cold lead when signals are absent', () => {
  const result = scoreLead({});
  assert.equal(result.tier, 'cold');
  assert.equal(result.score, 0);
});
