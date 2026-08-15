import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketingContent, buildPipelineDecision } from './orchestrator.mjs';

test('marketing content never exposes seller contact or private identity', () => {
  const entity = {
    id: 'p-662', entity_type: 'property', city: 'مدينة السادات', district: 'المنطقة 21',
    property_type: 'land', transaction_type: 'sale', area_m2: 622, price: 7100000, currency: 'EGP',
    confidence: 0.9, provenance_count: 7, owner_name: 'مالك سري', primary_phone: '+201000925451', office_name: 'مكتب سري',
    features: { parcel_number: 662, installments_clear: true },
  };
  const result = buildMarketingContent(entity, 'telegram');
  assert.equal(result.public_contact_policy, 'lara_brand_only');
  assert.equal(result.style, 'sales_marketing');
  assert.doesNotMatch(result.body, /01000925451|201000925451|مالك سري|مكتب سري/);
  assert.match(result.body, /لارا للتسويق العقاري/);
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
