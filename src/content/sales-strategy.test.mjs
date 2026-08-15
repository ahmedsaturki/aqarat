import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMarketingAngle, buildPersuasionPlan, renderSalesFramework } from './sales-strategy.mjs';

test('selects location angle when district is verified', () => {
  const result = chooseMarketingAngle({ city: 'مدينة السادات', district: 'المنطقة 21' });
  assert.equal(result.key, 'location');
});

test('land with area and price gets investment angle', () => {
  const result = chooseMarketingAngle({ property_type: 'land', area_m2: 622, price: 7100000, currency: 'EGP' }, {});
  assert.equal(result.key, 'investment');
});

test('persuasion plan forbids fabricated urgency and private contact data', () => {
  const plan = buildPersuasionPlan({ city: 'مدينة السادات', district: 'المنطقة 21', area_m2: 622, price: 7100000 }, { channel: 'facebook' });
  assert.equal(plan.urgency, 'none');
  assert.ok(plan.guardrails.includes('no private seller/office contact details'));
  assert.equal(plan.tone, 'conversational');
});

test('sales framework is benefit-led without exposing seller phone', () => {
  const result = renderSalesFramework({
    city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', area_m2: 622, price: 7100000, currency: 'EGP',
    primary_phone: '+201000925451',
  }, { channel: 'telegram' });
  assert.match(result.body, /فرصة/);
  assert.match(result.body, /لارا للتسويق العقاري/);
  assert.doesNotMatch(result.body, /01000925451|201000925451/);
});
