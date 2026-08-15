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

test('parses the exact Sadat land examples consistently', () => {
  const a = parseNaturalLanguageProperty('ارض 622متر فى المنطقة 21 بمدينة السادات رقم القطعة 662 للبيع 7مليون 100').parsed;
  const b = parseNaturalLanguageProperty('للبيع قطعة ارض بالمنطقة 21 بمدينة السادات رقم 662 مساحة 622 خالصة الاقساط مطلوب نهائى ٧ مليون ١٠٠ جنية رقم التواصل 01000925451').parsed;

  for (const parsed of [a, b]) {
    assert.equal(parsed.city, 'مدينة السادات');
    assert.equal(parsed.property_type, 'land');
    assert.equal(parsed.transaction_type, 'sale');
    assert.equal(parsed.district, 'المنطقة 21');
    assert.equal(parsed.parcel_number, 662);
    assert.equal(parsed.area_m2, 622);
    assert.equal(parsed.price, 7100000);
  }

  assert.equal(b.installments_clear, true);
  assert.equal(b.contacts[0].normalized_value, '+201000925451');
  assert.equal(propertyDedupKey(a), propertyDedupKey(b));
});

test('normalizes Arabic-Indic digits in phone and price', () => {
  const { parsed } = parseNaturalLanguageProperty('أرض ٦٢٢ متر بمدينة السادات رقم القطعة ٦٦٢ للبيع ٧ مليون ١٠٠ رقم التواصل ٠١٠٠٠٩٢٥٤٥١');
  assert.equal(parsed.area_m2, 622);
  assert.equal(parsed.parcel_number, 662);
  assert.equal(parsed.price, 7100000);
  assert.equal(parsed.contacts[0].normalized_value, '+201000925451');
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
  const event = buildIntakeEvent({ channel: 'telegram', externalEventId: 'tg-100', senderId: '42', chatId: '99', rawText: 'فيلا 300 متر في مدينة السادات للبيع 5 مليون 01012345678' });
  assert.equal(event.channel, 'telegram');
  assert.equal(event.external_event_id, 'tg-100');
  assert.equal(event.parsed_payload.parser.name, 'aqarat-deterministic-intake-v2');
  assert.equal(event.parsed_payload.property.price, 5000000);
});

test('dedup key is stable for equivalent candidates', () => {
  const a = { city: 'مدينة السادات', district: 'المنطقة السابعة', property_type: 'apartment', transaction_type: 'sale', area_m2: 120, price: 2400000, bedrooms: 3, bathrooms: 2 };
  const b = { ...a };
  assert.equal(propertyDedupKey(a), propertyDedupKey(b));
});
