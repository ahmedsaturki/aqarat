import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicBrandConfig } from './public-brand.mjs';

test('public brand config has the current Lara defaults', () => {
  const config = getPublicBrandConfig({});
  assert.equal(config.brand, 'لارا للتسويق العقاري');
  assert.equal(config.phone, '01000925451');
  assert.equal(config.whatsapp, '01000925451');
});

test('public brand config can be switched without code changes', () => {
  const config = getPublicBrandConfig({
    PUBLIC_MARKETING_BRAND: 'شركة اختبار العقارية',
    PUBLIC_MARKETING_PHONE: '01011112222',
    PUBLIC_MARKETING_WHATSAPP: '01033334444',
    PUBLIC_MARKETING_WEBSITE: 'https://example.test',
  });
  assert.deepEqual(config, {
    brand: 'شركة اختبار العقارية',
    phone: '01011112222',
    whatsapp: '01033334444',
    website: 'https://example.test',
  });
});
