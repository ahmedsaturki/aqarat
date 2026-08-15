import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPipelineDecision, classifyInterest, resolveCandidates } from './orchestrator.mjs';

test('resolver groups duplicate property candidates and chooses highest-confidence canonical', () => {
  const result = resolveCandidates([
    { id: 'a', city: 'مدينة السادات', property_type: 'land', transaction_type: 'sale', parcel_number: 662, area_m2: 622, price: 7100000, confidence: 0.8 },
    { id: 'b', city: 'السادات', property_type: 'land', transaction_type: 'sale', parcel_number: 662, area_m2: 622, price: 7100000, confidence: 0.9 },
    { id: 'c', city: 'مدينة السادات', property_type: 'land', transaction_type: 'sale', parcel_number: 663, area_m2: 900, price: 9500000, confidence: 0.7 },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].canonical.id, 'b');
  assert.equal(result[0].match_count, 2);
});

test('pipeline keeps external channels human-assisted', () => {
  const entity = {
    id: 'p-662', city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale',
    area_m2: 622, price: 7100000, currency: 'EGP', confidence: 0.9, provenance_count: 7,
    primary_phone: '+201000925451', features: { parcel_number: 662 },
  };
  const decision = buildPipelineDecision({ entity, leadSignal: { has_contact: true }, channel: 'facebook' });
  assert.equal(decision.publication.requires_human, true);
  assert.equal(decision.publication.status, 'blocked_review');
  assert.equal(decision.marketing_content.public_contact_policy, 'lara_brand_only');
});

test('pipeline can approve owned telegram marketing content with evidence', () => {
  const entity = {
    id: 'p-662', city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale',
    area_m2: 622, price: 7100000, currency: 'EGP', confidence: 0.95, provenance_count: 7,
    primary_phone: '+201000925451', features: { parcel_number: 662 },
  };
  const result = buildPipelineDecision({
    entity,
    leadSignal: { has_contact: true, explicit_intent_score: 0.8, property_interest_score: 0.8, sadat_city_score: 1, recency_score: 1 },
    channel: 'telegram',
  });

  assert.equal(result.review.approved, true);
  assert.equal(result.publication.status, 'queued');
  assert.equal(result.publication.requires_human, false);
  assert.equal(result.ready_for_publication, true);
  assert.match(result.marketing_content.body, /لارا للتسويق العقاري/);
  assert.match(result.marketing_content.body, /01000925451/);
  assert.doesNotMatch(result.marketing_content.body, /201000925451/);
  assert.doesNotMatch(result.marketing_content.body, /7100000|7 مليون/);
  assert.equal(result.marketing_content.psychology_policy, 'ethical_influence');
});

test('pipeline rejects manually supplied content that leaks seller phone', () => {
  assert.throws(
    () => buildPipelineDecision({
      entity: { city: 'مدينة السادات', confidence: 0.9, provenance_count: 1, primary_phone: '+201000925451' },
      leadSignal: {},
      content: 'أرض للبيع للتواصل 01000925451',
      channel: 'telegram',
    }),
    /public_marketing_privacy_violation/,
  );
});

test('pipeline derives buyer and seller intent only from explicit evidence', () => {
  const buyer = classifyInterest({ text: 'بدور على أرض في مدينة السادات', property: { city: 'مدينة السادات', property_type: 'land' }, channel: 'telegram' });
  assert.equal(buyer.intent, 'buyer');
  assert.ok(buyer.score > 0);
});
