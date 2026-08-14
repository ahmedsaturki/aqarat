import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryPlan, discoveryJobPayload } from './planner.mjs';

test('builds bounded targeted Sadat discovery plan', () => {
  const plan = buildDiscoveryPlan({
    sourceKey: 'operator-submitted',
    query: 'شقق للبيع',
    urls: ['https://example.com/a', 'https://example.com/a', ''],
  });

  assert.equal(plan.city, 'مدينة السادات');
  assert.equal(plan.mode, 'targeted');
  assert.deepEqual(plan.targets, ['https://example.com/a']);
  assert.equal(plan.limits.max_pages_per_target, 5);
});

test('requires a source identity', () => {
  assert.throws(() => buildDiscoveryPlan({}), /discovery_source_required/);
});

test('produces a durable worker payload', () => {
  const plan = buildDiscoveryPlan({ sourceId: 'src-1' });
  assert.deepEqual(discoveryJobPayload(plan), {
    source_id: 'src-1',
    source_key: null,
    city: 'مدينة السادات',
    country: 'Egypt',
    query: 'real estate',
    targets: [],
    limits: {
      max_targets: 20,
      max_pages_per_target: 5,
      max_entities_per_run: 100,
    },
  });
});
