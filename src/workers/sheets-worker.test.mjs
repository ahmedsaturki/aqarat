import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSheetsProjection, executeSheetsProjection } from './sheets-worker.mjs';

test('Sheets worker builds a stable property projection', () => {
  const job = { id: 'job-1', job_type: 'google_sheets_projection' };
  const property = {
    id: 'prop-1',
    status: 'active',
    transaction_type: 'sale',
    property_type: 'apartment',
    city: 'مدينة السادات',
    price: 1000000,
    currency: 'EGP',
  };

  const projection = buildSheetsProjection(job, property, {
    source_channel: 'telegram',
    source_event_id: 'evt-1',
  });

  assert.equal(projection.external_key, 'prop-1');
  assert.equal(projection.projection_type, 'google_sheets');
  assert.equal(projection.values[0], 'prop-1');
});

test('Sheets worker delegates exactly one upsert to transport', async () => {
  const calls = [];
  const transport = {
    async upsertRow(projection) {
      calls.push(projection);
      return { spreadsheet_row: 7 };
    },
  };

  const result = await executeSheetsProjection(
    { id: 'job-2', job_type: 'google_sheets_projection' },
    {
      id: 'prop-2',
      status: 'active',
      transaction_type: 'rent',
      property_type: 'villa',
      city: 'مدينة السادات',
      currency: 'EGP',
    },
    transport,
  );

  assert.equal(calls.length, 1);
  assert.equal(result.result.spreadsheet_row, 7);
  assert.equal(calls[0].external_key, 'prop-2');
});
