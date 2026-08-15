import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicMarketingContext, renderSalesCopy, assertPublicCopySafe } from './marketing-policy.mjs';

test('public marketing context suppresses seller, source identity and price data', () => {
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
  assert.equal(ctx.property.price, undefined);
  assert.equal(ctx.property.currency, undefined);
  assert.equal(ctx.public_price_policy, 'never_publish_internal_price');
  assert.ok(ctx.suppressed_fields.includes('owner_name'));
  assert.ok(ctx.suppressed_fields.includes('primary_phone'));
  assert.ok(ctx.suppressed_fields.includes('price'));
});

test('sales copy uses configured Lara CTA and not seller contact or internal price', () => {
  const copy = renderSalesCopy({
    city: 'مدينة السادات', district: 'المنطقة 21', property_type: 'land',
    transaction_type: 'sale', area_m2: 622, price: 7100000, currency: 'EGP',
    primary_phone: '+201000925451',
  });
  assert.match(copy, /لارا للتسويق العقاري/);
  assert.match(copy, /01000925451/);
  assert.doesNotMatch(copy, /201000925451/);
  assert.doesNotMatch(copy, /7100000|7[,،]?100[,،]?000|7 مليون/);
});

test('public safety gate blocks leaked private contact data', () => {
  const result = assertPublicCopySafe(
    'أرض للبيع. للتواصل 01000925451',
    { primary_phone: '+201000925451', owner_name: 'مالك سري' },
    'facebook',
  );
  assert.equal(result.ok, false);
});

test('public safety gate blocks leaked internal price', () => {
  const result = assertPublicCopySafe(
    'أرض للبيع بسعر 7100000 جنيه — لارا للتسويق العقاري.',
    { price: 7100000, currency: 'EGP' },
    'facebook',
  );
  assert.equal(result.ok, false);
});

test('public safety gate blocks an unrelated Egyptian phone even when it is not on the entity', () => {
  const result = assertPublicCopySafe(
    'أرض مميزة في مدينة السادات. للتواصل 01112345678 — لارا للتسويق العقاري.',
    { city: 'مدينة السادات' },
    'telegram',
  );
  assert.equal(result.ok, false);
});

test('public safety gate requires Lara brand on public channels', () => {
  const result = assertPublicCopySafe(
    'أرض مميزة في مدينة السادات.',
    { city: 'مدينة السادات' },
    'facebook',
  );
  assert.equal(result.ok, false);
});

test('public safety gate allows a marketing CTA without private contact data or internal price', () => {
  const result = assertPublicCopySafe(
    'أرض مميزة في مدينة السادات. للتفاصيل تواصل مع لارا للتسويق العقاري على 01000925451.',
    { primary_phone: '+201000925451', owner_name: 'مالك سري', price: 7100000 },
    'telegram',
  );
  assert.equal(result.ok, true);
});
