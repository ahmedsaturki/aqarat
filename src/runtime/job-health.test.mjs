import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeJobHealth, jobHealthLimits } from './job-health.mjs';

const now = new Date('2026-08-17T12:00:00.000Z');

test('summarizes queue lag, dead letters, and expired leases', () => {
  const result = summarizeJobHealth([
    { status: 'queued', attempts: 1, max_attempts: 5, available_at: '2026-08-17T11:55:00.000Z' },
    { status: 'running', attempts: 5, max_attempts: 5, started_at: '2026-08-17T11:50:00.000Z', lease_expires_at: '2026-08-17T11:59:00.000Z' },
    { status: 'failed', attempts: 5, max_attempts: 5 },
    { status: 'succeeded', attempts: 1, max_attempts: 5 },
  ], now);

  assert.equal(result.queued_jobs, 1);
  assert.equal(result.running_jobs, 1);
  assert.equal(result.failed_jobs, 1);
  assert.equal(result.dead_letter_jobs, 2);
  assert.equal(result.expired_leases, 1);
  assert.equal(result.lag_seconds, 300);
  assert.equal(result.status, 'degraded');
});

test('returns healthy empty queue without fabricated timestamps', () => {
  assert.deepEqual(summarizeJobHealth([], now), {
    sampled_jobs: 0,
    truncated: false,
    queued_jobs: 0,
    running_jobs: 0,
    failed_jobs: 0,
    dead_letter_jobs: 0,
    expired_leases: 0,
    oldest_queued_at: null,
    oldest_running_at: null,
    lag_seconds: 0,
    status: 'ok',
  });
});

test('bounds sampled rows', () => {
  const rows = Array.from({ length: jobHealthLimits.maxRows + 20 }, () => ({ status: 'queued' }));
  const result = summarizeJobHealth(rows, now);
  assert.equal(result.sampled_jobs, jobHealthLimits.maxRows);
  assert.equal(result.truncated, true);
});
