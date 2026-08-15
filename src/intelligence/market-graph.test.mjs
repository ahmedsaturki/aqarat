import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInterestSignal, buildInterestProfile, summarizeMarketSignal } from './market-graph.mjs';

test('classifies an explicit buyer signal without inventing property facts', () => {
  const signal = classifyInterestSignal({ text: 'بدور على أرض في مدينة السادات', property: { city: 'مدينة السادات' }, channel: 'telegram' });
  assert.equal(signal.intent, 'buyer');
  assert.ok(signal.score > 0);
  assert.ok(signal.evidence.matched_terms.length > 0);
});

test('builds a bounded interest profile', () => {
  const profile = buildInterestProfile({ personId: 'p1', signal: { intent: 'buyer', score: 0.8, evidence: { source: 'telegram' } }, property: { city: 'مدينة السادات', property_type: 'land', area_m2: 622, price: 7100000 } });
  assert.equal(profile.interest_type, 'buyer');
  assert.equal(profile.city, 'مدينة السادات');
  assert.equal(profile.max_area_m2, 622);
  assert.equal(profile.intent_score, 0.8);
});

test('summarizes funnel performance safely', () => {
  const result = summarizeMarketSignal({ impressions: 1000, views: 400, replies: 40, qualifiedInquiries: 10, conversions: 2 });
  assert.equal(result.view_rate, 0.4);
  assert.equal(result.reply_rate, 0.1);
  assert.equal(result.qualified_rate, 0.25);
  assert.equal(result.conversion_rate, 0.2);
});
