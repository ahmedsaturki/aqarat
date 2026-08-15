import test from 'node:test';
import assert from 'node:assert/strict';
import { redactForAI, redactPhoneNumbers, redactEmails } from './pii-redactor.mjs';

test('redacts Egyptian ASCII and Arabic-Indic phone formats', () => {
  assert.equal(redactPhoneNumbers('اتصل 01000925451'), 'اتصل [PHONE_REDACTED]');
  assert.equal(redactPhoneNumbers('اتصل ٠١٠٠٠٩٢٥٤٥١'), 'اتصل [PHONE_REDACTED]');
  assert.equal(redactPhoneNumbers('اتصل +201000925451'), 'اتصل [PHONE_REDACTED]');
  assert.equal(redactPhoneNumbers('اتصل 00201000925451'), 'اتصل [PHONE_REDACTED]');
});

test('redacts email', () => {
  assert.equal(redactEmails('email ahmed@example.com الآن'), 'email [EMAIL_REDACTED] الآن');
});

test('redactForAI strips identity keys recursively and redacts free text', () => {
  const result = redactForAI({
    property: { city: 'مدينة السادات', price: 7100000, owner_name: 'مالك سري', phone: '01000925451' },
    evidence: { text: 'للتواصل owner@example.com / ٠١٠٠٠٩٢٥٤٥١' },
    nested: [{ seller_name: 'سري', note: 'واتساب +201000925451' }],
  });
  assert.equal(result.property.owner_name, undefined);
  assert.equal(result.property.phone, undefined);
  assert.equal(result.property.price, 7100000);
  assert.match(result.evidence.text, /\[EMAIL_REDACTED\]/);
  assert.match(result.evidence.text, /\[PHONE_REDACTED\]/);
  assert.equal(result.nested[0].seller_name, undefined);
});
