import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFactualDraft } from './factual-draft.mjs';

test('draft contains only known property facts', () => {
  const draft = buildFactualDraft({
    city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale',
    parcel_number: 662, area_m2: 622, installments_clear: true, price: 7100000, currency: 'EGP', confidence: 0.9,
  }, { channel: 'telegram', primary_phone: '+201000925451', source_url: 'https://example.test/property/662' });

  assert.match(draft.body, /المنطقة 21/);
  assert.match(draft.body, /662/);
  assert.match(draft.body, /622/);
  assert.match(draft.body, /7.?100.?000|٧٬١٠٠٬٠٠٠|7,100,000/);
  assert.match(draft.body, /خالصة/);
  assert.match(draft.body, /01000925451/);
  assert.equal(draft.generated_by, 'aqarat-factual-draft-v1');
  assert.equal(draft.claims.length >= 8, true);
});

test('draft does not invent missing facts', () => {
  const draft = buildFactualDraft({
    city: 'مدينة السادات', property_type: 'land', transaction_type: 'sale'
  }, { channel: 'telegram' });

  assert.doesNotMatch(draft.body, /662/);
  assert.doesNotMatch(draft.body, /622/);
  assert.doesNotMatch(draft.body, /7,100,000/);
  assert.equal(draft.provenance.length, 0);
});
