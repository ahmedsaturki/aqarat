import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicMarketingContext, renderSalesCopy, assertPublicCopySafe } from './marketing-policy.mjs';

test('public marketing context suppresses seller and source identity data', () => {
  const ctx = buildPublicMarketingContext({
    city: 'مدينة السادات',
    district: 'المنطقة 21',
    property_type: 'land',
    transaction_type: 'sale',
    area_m2: 622,
    price: 7100000,
    currency: 'EGP',
    owner_name: 'مالك سري',
    primary_phone: '+201000925451',
    office_name: 'مكتب سري',
    source_url: 'https://example.invalid/private',
  });

  assert.equal(ctx.property.owner_name, undefined);
  assert.equal(ctx.property.primary_phone, undefined);
  assert.equal(ctx.property.office_name, undefined);
  assert.ok(ctx.suppressed_fields.includes('owner_name'));
  assert.ok(ctx.suppressed_fields.includes('primary_phone'));
});

test('sales copy uses Lara CTA and not seller contact', () => {
  const copy = renderSalesCopy({
    city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land',
    transaction_type: 'sale', area_m2: 622, price: 7100000, currency: 'EGP',
    primary_phone: '+201000925451',
  });
  assert.match(copy, /لارا للتسويق العقاري/);
  assert.doesNotMatch(copy, /01000925451|201000925451/);
});

test('public safety gate blocks leaked private contact data', () => {
  const result = assertPublicCopySafe(
    'أرض للبيع. للتواصل 01000925451',
    { primary_phone: '+201000925451', owner_name: 'مالك سري' },
    'facebook',
  );
  assert.equal(result.ok, false);
});

test('public safety gate allows a marketing CTA without private contact data', () => {
  const result = assertPublicCopySafe(
    'أرض مميزة في مدينة السادات. للتفاصيل تواصل مع لارا للتسويق العقاري.',
    { primary_phone: '+201000925451', owner_name: 'مالك سري' },
    'telegram',
  );
  assert.equal(result.ok, true);
});
