import test from 'node:test';
import assert from 'node:assert/strict';

import { telegramCommand, telegramUpdateToIntakeEvent } from './telegram.mjs';
import { propertyToSheetRow, sheetHeaders } from './google-sheets.mjs';

test('Telegram adapter preserves provider identity and raw text', () => {
  const event = telegramUpdateToIntakeEvent({
    update_id: 9001,
    message: {
      from: { id: 123 },
      chat: { id: -456 },
      text: 'شقة 120 متر في المنطقة السابعة بمدينة السادات، للبيع 2.4 مليون',
    },
  });

  assert.equal(event.channel, 'telegram');
  assert.equal(event.external_event_id, '9001');
  assert.equal(event.sender_id, '123');
  assert.equal(event.chat_id, '-456');
  assert.match(event.raw_text, /شقة 120 متر/);
  assert.equal(event.parsed_payload.property.city, 'مدينة السادات');
});

test('Telegram command parser separates command and args', () => {
  const command = telegramCommand({
    message: {
      from: { id: 10 },
      chat: { id: 20 },
      text: '/add @aqarat_bot 3rd district',
    },
  });

  assert.deepEqual(command, {
    command: 'add',
    mention: 'aqarat_bot',
    args: ['3rd', 'district'],
    raw_text: '/add @aqarat_bot 3rd district',
    sender_id: '10',
    chat_id: '20',
  });
});

test('Sheets projection is deterministic and column ordered', () => {
  const property = {
    id: 'prop-1',
    status: 'active',
    transaction_type: 'sale',
    property_type: 'apartment',
    title: 'شقة للبيع — مدينة السادات',
    city: 'مدينة السادات',
    district: 'المنطقة السابعة',
    area_m2: 120,
    bedrooms: 3,
    bathrooms: 2,
    price: 2400000,
    currency: 'EGP',
    confidence: 0.89,
    updated_at: '2026-08-14T00:00:00Z',
  };

  const row = propertyToSheetRow(property, {
    source_channel: 'telegram',
    source_event_id: '9001',
    primary_phone: '+201012345678',
  });

  assert.equal(row.external_key, 'prop-1');
  assert.equal(row.columns.length, row.values.length);
  assert.equal(row.columns[0], 'property_id');
  assert.equal(row.values[0], 'prop-1');
  assert.equal(row.values[row.columns.indexOf('primary_phone')], '+201012345678');
  assert.deepEqual(row.columns, sheetHeaders());
});
