import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePropertyMatch, chooseCanonical } from './entity-resolver.mjs';

test('same phone strongly matches two property candidates', () => {
  const result = scorePropertyMatch(
    { phone: '01012345678', address: 'District 7', city: 'Sadat City', name: 'Apartment 120' },
    { phone: '+201012345678', address: 'District 7', city: 'Sadat City', name: 'Apartment 120' },
  );
  assert.equal(result.score, 1);
  assert.ok(result.reasons.includes('same_phone'));
});

test('same Sadat land parcel matches even when contact differs', () => {
  const result = scorePropertyMatch(
    { city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale', parcel_number: 662, area_m2: 622, price: 7100000, phone: '01000000000' },
    { city: 'السادات', district: 'المنطقه 21', property_type: 'land', transaction_type: 'sale', parcel_number: 662, area_m2: 622, price: 7100000, phone: '01000925451' },
  );
  assert.ok(result.score >= 0.95, `score=${result.score}`);
  assert.ok(result.reasons.includes('same_parcel_city_type'));
  assert.ok(result.reasons.includes('same_area'));
  assert.ok(result.reasons.includes('same_price'));
});

test('different parcel does not get a strong identity match from shared city alone', () => {
  const result = scorePropertyMatch(
    { city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale', parcel_number: 662, area_m2: 622, price: 7100000 },
    { city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land', transaction_type: 'sale', parcel_number: 663, area_m2: 900, price: 9500000 },
  );
  assert.ok(result.score < 0.85, `score=${result.score}`);
});

test('canonical candidate is the highest-confidence and most complete evidence', () => {
  const result = chooseCanonical([
    { confidence: 0.4, source_url: 'https://b.example', area_m2: 100 },
    { confidence: 0.91, source_url: 'https://a.example' },
    { confidence: 0.91, source_url: 'https://c.example', area_m2: 120, price: 7000000, parcel_number: 662 },
  ]);
  assert.equal(result.source_url, 'https://c.example');
});
