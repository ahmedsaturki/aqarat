import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates, normalizePhone } from './entity-extractor.mjs';

test('normalizes Egyptian mobile numbers', () => {
  assert.equal(normalizePhone('01012345678'), '+201012345678');
  assert.equal(normalizePhone('+201012345678'), '+201012345678');
  assert.equal(normalizePhone('not-a-phone'), null);
});

test('extracts a Sadat City property from JSON-LD', () => {
  const candidates = extractCandidates({
    source_url: 'https://example.com/listing',
    canonical_url: 'https://example.com/listing/123',
    extracted_payload: {
      title: '3 Bedroom Apartment - Sadat City',
      description: 'Apartment for sale in Sadat City Egypt',
      text: 'مدينة السادات',
      json_ld: [{
        '@type': 'Apartment',
        name: '3 Bedroom Apartment - Sadat City',
        telephone: '01012345678',
        address: { addressLocality: 'Sadat City', streetAddress: 'District 7' },
        offers: { price: '2400000', priceCurrency: 'EGP' },
        numberOfBedrooms: 3,
        numberOfBathrooms: 2,
      }],
    },
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].entity_type, 'property');
  assert.equal(candidates[0].city, 'Sadat City');
  assert.equal(candidates[0].phone, '+201012345678');
  assert.equal(candidates[0].attributes.price, 2400000);
  assert.equal(candidates[0].attributes.bedrooms, 3);
  assert.equal(candidates[0].confidence, 0.82);
});

test('falls back to a low-confidence Sadat candidate without structured markup', () => {
  const candidates = extractCandidates({
    source_url: 'https://example.com',
    extracted_payload: {
      title: 'Real estate in Sadat City',
      description: 'Listings and properties',
      text: 'مدينة السادات',
      json_ld: [],
    },
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].city, 'Sadat City');
  assert.equal(candidates[0].confidence, 0.35);
});
