import { createHash } from 'node:crypto';
import { fetchPublicSource } from './http-adapter.mjs';
import { assertDiscoverySourceAllowed } from './source-policy.mjs';
import { extractCandidates } from './entity-extractor.mjs';

const SB_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKER = process.env.DISCOVERY_WORKER_NAME || `github-discovery-${process.pid}`;

function authHeaders(extra = {}) {
  return {
    apikey: SB_KEY,
    authorization: `Bearer ${SB_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function sb(path, init = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('discovery_worker_supabase_config_missing');
  const response = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: authHeaders(init.headers),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    const error = new Error(`supabase_http_${response.status}${detail ? `:${detail.slice(0, 500)}` : ''}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function claimOne() {
  const rows = await sb('/rest/v1/discovery_jobs?status=eq.queued&available_at=lte.now()&order=priority.desc,created_at&limit=1&select=*');
  const job = rows?.[0];
  if (!job) return null;
  const lock = await sb(`/rest/v1/discovery_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.queued`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'running', attempts: Number(job.attempts || 0) + 1, locked_by: WORKER, locked_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
  return lock?.[0] ?? null;
}

async function getSource(id) {
  const rows = await sb(`/rest/v1/discovery_sources?id=eq.${encodeURIComponent(id)}&limit=1&select=*`);
  return rows?.[0] ?? null;
}

async function upsertEvidence(job, source, fetched) {
  const contentHash = createHash('sha256').update(fetched.content_hash_input || '').digest('hex');
  const rows = await sb('/rest/v1/discovery_evidence?on_conflict=run_id,url', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      run_id: job.run_id,
      source_id: source.id,
      url: fetched.source_url,
      canonical_url: fetched.canonical_url,
      title: fetched.extracted_payload?.title ?? null,
      captured_at: fetched.fetched_at,
      content_hash: contentHash,
      raw_data: { worker: WORKER, content_type: 'text/html' },
      extraction: fetched.extracted_payload,
    }),
  });
  return rows?.[0] ?? null;
}

async function insertEntities(job, evidence, candidates) {
  if (!candidates.length) return 0;
  const payload = candidates.map((candidate) => ({
    ...candidate,
    run_id: job.run_id,
    evidence_id: evidence?.id ?? null,
    status: 'candidate',
    external_key: createHash('sha256').update(JSON.stringify({
      type: candidate.entity_type,
      name: candidate.name,
      phone: candidate.phone,
      address: candidate.address,
      city: candidate.city,
      source: candidate.source_url,
    })).digest('hex'),
  }));
  const rows = await sb('/rest/v1/discovery_entities?on_conflict=entity_type,external_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows.length : 0;
}

async function finish(job, patch) {
  await sb(`/rest/v1/discovery_jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString(), locked_by: null, locked_at: null }),
  });
}

async function main() {
  const job = await claimOne();
  if (!job) {
    console.log(JSON.stringify({ ok: true, claimed: false }));
    return;
  }

  try {
    const source = await getSource(job.payload?.source_id);
    if (!source) throw new Error('discovery_source_not_found');
    const target = job.payload?.url || source.base_url;
    assertDiscoverySourceAllowed(source, target);

    const fetched = await fetchPublicSource(target, {
      timeoutMs: Math.min(Number(source.config?.timeout_ms || 15000), 30000),
    });
    const evidence = await upsertEvidence(job, source, fetched);
    const candidates = extractCandidates(evidence ? { ...fetched, ...evidence } : fetched);
    const entities = await insertEntities(job, evidence, candidates);

    await finish(job, {
      status: 'succeeded',
      last_error: null,
      result: { evidence_id: evidence?.id ?? null, entities_inserted: entities },
      finished_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({ ok: true, claimed: true, job_id: job.id, evidence_id: evidence?.id ?? null, entities }));
  } catch (error) {
    const attempts = Number(job.attempts || 1);
    const retryable = attempts < Number(job.max_attempts || 5) && !String(error.message).startsWith('discovery_source_policy_blocked');
    await finish(job, {
      status: retryable ? 'queued' : 'failed',
      last_error: error.message,
      available_at: retryable ? new Date(Date.now() + Math.min(300000, attempts * 30000)).toISOString() : new Date().toISOString(),
      finished_at: retryable ? null : new Date().toISOString(),
    });
    console.error(JSON.stringify({ ok: false, job_id: job.id, error: error.message, retryable }));
    process.exitCode = 1;
  }
}

await main();
