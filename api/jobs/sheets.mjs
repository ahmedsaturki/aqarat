import { processSheetsJobs } from '../../src/runtime/sheets-worker.mjs';

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return json(res, 404, { ok: false, error: 'external_integrations_disabled_in_preview' });
  }

  const expected = process.env.JOB_RUNNER_SECRET || '';
  if (!expected || req.headers['x-job-runner-secret'] !== expected) {
    return json(res, 401, { ok: false, error: 'job_runner_unauthorized' });
  }

  try {
    const results = await processSheetsJobs(5, 'vercel-sheets-worker');
    return json(res, 200, { ok: true, results });
  } catch (error) {
    console.error(JSON.stringify({ event: 'sheets_worker_error', error: error?.message || String(error) }));
    return json(res, 500, { ok: false, error: 'sheets_worker_failed' });
  }
}
