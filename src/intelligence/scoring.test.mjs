import test from 'node:test';
import assert from 'node:assert/strict';

import { scorePropertyMatch, scorePropertyOpportunity, rankPropertyMatches } from './scoring.mjs';

test('fresh high-confidence property gets a strong opportunity score', () => {
  const score = scorePropertyOpportunity({
    id: 'p1', status: 'active', confidence: 0.95,
    city: 'مدينة السادات', district: 'المنطقة السابعة', property_type: 'apartment',
    transaction_type: 'sale', area_m2: 120, price: 2_400_000,
    bedrooms: 3, bathrooms: 2, last_seen_at: '2026-08-15T00:00:00Z'
  }, { nowMs: Date.parse('2026-08-15T12:00:00Z') });

  assert.ok(score.score > 0.8);
  assert.ok(score.reasons.includes('fresh_listing'));
  assert.ok(score.reasons.includes('high_confidence'));
});

test('stale property is explicitly marked stale', () => {
  const score = scorePropertyOpportunity({
    status: 'active', confidence: 0.8, city: 'مدينة السادات', property_type: 'land',
    transaction_type: 'sale', updated_at: '2026-06-01T00:00:00Z'
  }, { nowMs: Date.parse('2026-08-15T00:00:00Z') });

  assert.ok(score.freshness < 0.02);
  assert.ok(score.reasons.includes('stale_listing'));
});

test('buyer interest matches on city, type, transaction and ranges', () => {
  const result = scorePropertyMatch(
    { city: 'مدينة السادات', district: 'المنطقة السابعة', property_type: 'apartment', transaction_type: 'sale', price: 2_400_000, area_m2: 120 },
    { city: 'مدينة السادات', district: 'المنطقة السابعة', property_type: 'apartment', transaction_type: 'sale', min_price: 2_000_000, max_price: 2_800_000, min_area_m2: 100, max_area_m2: 140, intent_score: 0.9 },
  );

  assert.equal(result.qualified, true);
  assert.ok(result.score >= 0.9);
  assert.ok(result.signals.includes('city_match'));
  assert.ok(result.signals.includes('price_in_range'));
});

test('interest ranking is deterministic', () => {
  const property = { city: 'مدينة السادات', property_type: 'apartment', transaction_type: 'sale', price: 2_400_000, area_m2: 120 };
  const ranked = rankPropertyMatches(property, [
    { id: 'low', city: 'القاهرة', property_type: 'villa', transaction_type: 'rent', intent_score: 0.2 },
    { id: 'high', city: 'مدينة السادات', property_type: 'apartment', transaction_type: 'sale', min_price: 2_000_000, max_price: 2_500_000, intent_score: 0.9 },
  ]);

  assert.equal(ranked[0].interest_id, 'high');
});
