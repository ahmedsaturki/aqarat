import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategy, chooseAudience, chooseFunnelStage, chooseAngles } from './strategy-framework.mjs';

test('seller intent routes to seller audience', () => {
  assert.equal(chooseAudience({ intent: 'seller' }), 'seller');
});

test('strong intent routes to action stage', () => {
  assert.equal(chooseFunnelStage({ explicit_intent_score: 0.9 }), 'action');
});

test('property evidence selects useful angles', () => {
  const angles = chooseAngles({ city: 'مدينة السادات', district: 'المنطقة 21', area_m2: 622, price: 7100000, property_type: 'land' });
  assert.ok(angles.includes('location'));
  assert.ok(angles.includes('value') || angles.includes('investment'));
});

test('strategy always includes core business objectives and prohibited manipulation', () => {
  const result = buildStrategy({ city: 'مدينة السادات' }, { intent: 'buyer' });
  assert.ok(result.objectives.includes('generate qualified conversations rather than raw impressions'));
  assert.ok(result.prohibited_tactics.includes('fake scarcity'));
  assert.ok(result.principles.includes('protect private source and seller data'));
});
