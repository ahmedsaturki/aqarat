import test from 'node:test';
import assert from 'node:assert/strict';
import { redactForAI, redactEvidenceForAI, redactPropertyForAI } from './privacy.mjs';

test('redacts Egyptian phones and emails from free text', () => {
  const result = redactForAI('اتصل 01000925451 أو mail@example.com');
  assert.equal(result.includes('01000925451'), false);
  assert.equal(result.includes('mail@example.com'), false);
  assert.match(result, /PHONE_REDACTED/);
  assert.match(result, /EMAIL_REDACTED/);
});

test('removes internal identity and source fields before AI', () => {
  const result = redactForAI({ owner_name: 'Private Owner', primary_phone: '01000925451', source_url: 'https://private.example', city: 'مدينة السادات', area_m2: 622 });
  assert.equal('owner_name' in result, false);
  assert.equal('primary_phone' in result, false);
  assert.equal('source_url' in result, false);
  assert.equal(result.city, 'مدينة السادات');
  assert.equal(result.area_m2, 622);
});

test('evidence boundary excludes canonical/source URL and raw private fields', () => {
  const result = redactEvidenceForAI({
    source_url: 'https://private.example/listing',
    canonical_url: 'https://private.example/listing/1',
    extracted_payload: { title: 'أرض للبيع', text: 'تواصل 01000925451' },
  });
  assert.equal(result.canonical_url, null);
  assert.equal(result.text.includes('01000925451'), false);
});

test('property boundary preserves public facts but removes contacts and ids', () => {
  const result = redactPropertyForAI({ city: 'مدينة السادات', price: 7100000, phone: '+201000925451', property_id: 'secret' });
  assert.equal(result.city, 'مدينة السادات');
  assert.equal(result.price, 7100000);
  assert.equal('phone' in result, false);
  assert.equal('property_id' in result, false);
});
