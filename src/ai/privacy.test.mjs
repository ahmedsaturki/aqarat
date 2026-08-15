import test from 'node:test';
import assert from 'node:assert/strict';
import { redactForAI, redactEvidenceForAI, redactPropertyForAI, assertAIInputSafe } from './privacy.mjs';

test('redacts Egyptian ASCII, Arabic-Indic, and international phones from free text', () => {
  const values = [
    redactForAI('اتصل 01000925451 أو mail@example.com'),
    redactForAI('اتصل ٠١٠٠٠٩٢٥٤٥١ أو owner@example.com'),
    redactForAI('اتصل +201000925451 أو 00201000925451'),
  ];
  for (const result of values) {
    assert.equal(/01000925451|٠١٠٠٠٩٢٥٤٥١|201000925451|00201000925451/.test(result), false);
    assert.match(result, /PHONE_REDACTED/);
    assert.match(result, /EMAIL_REDACTED/);
  }
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
    extracted_payload: { title: 'أرض للبيع', text: 'تواصل ٠١٠٠٠٩٢٥٤٥١ وowner@example.com' },
  });
  assert.equal(result.canonical_url, null);
  assert.equal(result.text.includes('٠١٠٠٠٩٢٥٤٥١'), false);
  assert.equal(result.text.includes('owner@example.com'), false);
});

test('property boundary preserves public facts but removes contacts and ids', () => {
  const result = redactPropertyForAI({ city: 'مدينة السادات', price: 7100000, phone: '+201000925451', property_id: 'secret' });
  assert.equal(result.city, 'مدينة السادات');
  assert.equal(result.price, 7100000);
  assert.equal('phone' in result, false);
  assert.equal('property_id' in result, false);
});

test('assertAIInputSafe returns redacted payload', () => {
  const safe = assertAIInputSafe({ city: 'مدينة السادات', evidence: '01000925451' });
  assert.equal(safe.evidence, '[PHONE_REDACTED]');
  assert.doesNotMatch(JSON.stringify(safe), /owner@example.com|01000925451/);
});
