import { performance } from 'node:perf_hooks';
import { timedFetch } from '../src/runtime/http.mjs';

const baseUrl = process.env.AQARAT_RELEASE_URL || process.env.BASE_URL || 'https://aqarat-eg.vercel.app';
const budgetMs = Number(process.env.PERF_P95_BUDGET_MS || 2_500);
const sampleCount = Math.max(3, Math.min(10, Number(process.env.PERF_SAMPLES || 5)));
const requestTimeoutMs = Math.max(1_000, Math.min(5_000, Number(process.env.PERF_REQUEST_TIMEOUT_MS || 5_000)));
const targets = [
  { path: '/api/healthz', status: 200 },
  { path: '/api/public-config', status: 200 },
];

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

async function sample(target) {
  const started = performance.now();
  const response = await timedFetch(new URL(target.path, baseUrl), {
    headers: { accept: 'application/json' },
    redirect: 'manual',
  }, requestTimeoutMs);
  const elapsedMs = Number((performance.now() - started).toFixed(2));
  await response.arrayBuffer();
  return { ...target, status: response.status, elapsedMs };
}

const results = [];
for (const target of targets) {
  for (let index = 0; index < sampleCount; index += 1) {
    try {
      results.push(await sample(target));
    } catch (error) {
      results.push({ ...target, status: null, elapsedMs: null, error: error?.name || 'request_failed' });
    }
  }
}

const summary = targets.map((target) => {
  const rows = results.filter((row) => row.path === target.path);
  const durations = rows.filter((row) => Number.isFinite(row.elapsedMs)).map((row) => row.elapsedMs);
  const statusOk = rows.every((row) => row.status === target.status);
  return {
    path: target.path,
    expectedStatus: target.status,
    statuses: rows.map((row) => row.status),
    samples: durations.length,
    p50Ms: durations.length ? percentile(durations, 0.5) : null,
    p95Ms: durations.length ? percentile(durations, 0.95) : null,
    statusOk,
    budgetMs,
    budgetOk: durations.length > 0 && percentile(durations, 0.95) <= budgetMs,
  };
});

console.log(JSON.stringify({ baseUrl, sampleCount, summary }, null, 2));

if (summary.some((row) => !row.statusOk || !row.budgetOk)) {
  process.exitCode = 1;
}
