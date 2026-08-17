const MAX_ROWS = 500;

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function summarizeJobHealth(rows, now = new Date()) {
  const current = new Date(now).getTime();
  const items = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
  const queued = items.filter((job) => job.status === 'queued');
  const running = items.filter((job) => job.status === 'running');
  const failed = items.filter((job) => job.status === 'failed');
  const deadLetter = items.filter((job) => Number(job.attempts || 0) >= Number(job.max_attempts || 5) && ['failed', 'queued', 'running'].includes(job.status));
  const expiredLeases = running.filter((job) => {
    const expiry = timestamp(job.lease_expires_at);
    return expiry !== null && expiry <= current;
  });
  const oldestQueued = queued.map((job) => timestamp(job.available_at || job.created_at)).filter((value) => value !== null).sort((a, b) => a - b)[0] ?? null;
  const oldestRunning = running.map((job) => timestamp(job.started_at || job.updated_at)).filter((value) => value !== null).sort((a, b) => a - b)[0] ?? null;
  const lagSource = oldestQueued ?? oldestRunning;
  const lagSeconds = lagSource === null ? 0 : Math.max(0, Math.floor((current - lagSource) / 1000));

  return {
    sampled_jobs: items.length,
    truncated: Array.isArray(rows) && rows.length > MAX_ROWS,
    queued_jobs: queued.length,
    running_jobs: running.length,
    failed_jobs: failed.length,
    dead_letter_jobs: deadLetter.length,
    expired_leases: expiredLeases.length,
    oldest_queued_at: oldestQueued === null ? null : new Date(oldestQueued).toISOString(),
    oldest_running_at: oldestRunning === null ? null : new Date(oldestRunning).toISOString(),
    lag_seconds: lagSeconds,
    status: deadLetter.length || expiredLeases.length ? 'degraded' : 'ok',
  };
}

export const jobHealthLimits = Object.freeze({ maxRows: MAX_ROWS });
