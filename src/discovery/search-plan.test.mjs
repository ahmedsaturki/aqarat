import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSadatSearchPlan } from './search-plan.mjs';

test('builds bounded Arabic and English Sadat City queries', () => {
  const plan = buildSadatSearchPlan({ maxQueries: 20 });
  assert.ok(plan.length > 5);
  assert.ok(plan.length <= 20);
  assert.ok(plan.some((item) => item.query.includes('مدينة السادات')));
  assert.ok(plan.some((item) => item.query.toLowerCase().includes('sadat city')));
  assert.equal(new Set(plan.map((item) => item.query)).size, plan.length);
  assert.ok(plan.every((item) => item.city === 'Sadat City' && item.country === 'Egypt'));
});

test('caps a caller-provided maxQuery count safely', () => {
  assert.equal(buildSadatSearchPlan({ maxQueries: 1 }).length, 1);
  assert.equal(buildSadatSearchPlan({ maxQueries: 100 }).length, 11);
});
