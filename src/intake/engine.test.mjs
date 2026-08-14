import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntakeEvent, parseNaturalLanguageProperty, propertyDedupKey } from './engine.mjs';

test('parses Arabic Sadat apartment listing into a valid candidate', () => {
  const input = 'شقة 120 متر في المنطقة السابعة بمدينة السادات، الدور الثالث، 3 غرف، 2 حمام، تشطيب جيد، للبيع 2.4 مليون جنيه. التواصل واتساب 01012345678';
  const { parsed, validation } = parseNaturalLanguageProperty(input);

  assert.equal(validation.valid, true);
  assert.equal(parsed.city, 'مدينة السادات');
  assert.equal(parsed.district, 'المنطقة السابعة');
  assert.equal(parsed.property_type, 'apartment');
  assert.equal(parsed.transaction_type, 'sale');
  assert.equal(parsed.area_m2, 120);
  assert.equal(parsed.bedrooms, 3);
  assert.equal(parsed.bathrooms, 2);
  assert.equal(parsed.price, 2400000);
  assert.equal(parsed.currency, 'EGP');
  assert.equal(parsed.floor, 'الثالث');
  assert.equal(parsed.finishing, 'good');
  assert.equal(parsed.contacts[0].normalized_value, '+201012345678');
});

test('rejects non-Sadat city input', () => {
  const { parsed, validation } = parseNaturalLanguageProperty('شقة 120 متر في الشيخ زايد للبيع 2 مليون');
  assert.equal(parsed.city, null);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('city_required'));
});

test('keeps missing data null instead of inventing it', () => {
  const { parsed } = parseNaturalLanguageProperty('أرض في مدينة السادات للبيع');
  assert.equal(parsed.city, 'مدينة السادات');
  assert.equal(parsed.property_type, 'land');
  assert.equal(parsed.transaction_type, 'sale');
  assert.equal(parsed.area_m2, null);
  assert.equal(parsed.price, null);
  assert.equal(parsed.bedrooms, null);
  assert.equal(parsed.bathrooms, null);
  assert.ok(parsed.unknown_fields.includes('area_m2'));
});

test('builds idempotent intake envelope', () => {
  const event = buildIntakeEvent({
    channel: 'telegram',
    externalEventId: 'tg-100',
    senderId: '42',
    chatId: '99',
    rawText: 'فيلا 300 متر في مدينة السادات للبيع 5 مليون 01012345678'
  });

  assert.equal(event.channel, 'telegram');
  assert.equal(event.external_event_id, 'tg-100');
  assert.equal(event.parsed_payload.parser.name, 'aqarat-deterministic-intake-v1');
  assert.equal(event.parsed_payload.property.price, 5000000);
});

test('dedup key is stable for equivalent candidates', () => {
  const a = { city: 'مدينة السادات', district: 'المنطقة السابعة', property_type: 'apartment', transaction_type: 'sale', area_m2: 120, price: 2400000, bedrooms: 3, bathrooms: 2 };
  const b = { ...a };
  assert.equal(propertyDedupKey(a), propertyDedupKey(b));
});
