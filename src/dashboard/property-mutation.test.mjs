import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyMutationFields, validatePropertyMutation } from './property-mutation.mjs';

test('property mutation exposes a bounded allowlist', () => {
  assert.equal(propertyMutationFields.includes('title'), true);
  assert.equal(propertyMutationFields.includes('owner_phone'), false);
  assert.equal(propertyMutationFields.includes('source_url'), false);
});

test('create requires city and transaction type', () => {
  const result = validatePropertyMutation({ title: 'شقة' }, { mode: 'create' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('city_required'));
  assert.ok(result.errors.includes('transaction_type_required'));
});

test('update accepts bounded safe fields and drops nothing silently', () => {
  const result = validatePropertyMutation({ id: '11111111-1111-1111-1111-111111111111', city: 'مدينة السادات', price: 2400000, bedrooms: 3, features: { elevator: true } }, { mode: 'update' });
  assert.equal(result.ok, true);
  assert.equal(result.changes.price, 2400000);
  assert.equal(result.changes.bedrooms, 3);
  assert.deepEqual(result.changes.features, { elevator: true });
});

test('invalid numeric, enum, feature and identifier values are rejected', () => {
  const result = validatePropertyMutation({ id: 'not-a-uuid', price: -1, status: 'deleted', features: [] }, { mode: 'update' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('property_id_invalid'));
  assert.ok(result.errors.includes('price_invalid'));
  assert.ok(result.errors.includes('status_invalid'));
  assert.ok(result.errors.includes('features_invalid'));
});

test('archive is an explicit status transition only', () => {
  const result = validatePropertyMutation({ id: '11111111-1111-1111-1111-111111111111', title: 'ignored' }, { mode: 'archive' });
  assert.deepEqual(result, { ok: true, mode: 'archive', id: '11111111-1111-1111-1111-111111111111', changes: { status: 'archived' } });
});
