import { fetchPublicSource } from './http-adapter.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKER_NAME = process.env.DISCOVERY_WORKER_NAME || `discovery-${process.pid}`;

function requireConfig() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL_required');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_required');
}

async function supabase(path, options = {}) {
  requireConfig();
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`supabase_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function claimJob() {
  const rows = await supabase('/rest/v1/rpc/claim_job', {
    method: 'POST',
    body: JSON.stringify({
      p_worker: WORKER_NAME,
      p_job_type: 'discovery_fetch',
      p_lease_seconds: 120,
    }),
  });
  return rows?.[0] ?? null;
}

async function getSource(sourceId) {
  const rows = await supabase(`/rest/v1/sources?id=eq.${encodeURIComponent(sourceId)}&select=id,name,source_type,base_url,enabled,crawl_policy,metadata&limit=1`);
  return rows?.[0] ?? null;
}

async function insertSourceRecord(job, source, fetched) {
  const record = {
    source_id: source.id,
    source_url: fetched.source_url,
    canonical_url: fetched.canonical_url,
    fetched_at: fetched.fetched_at,
    content_hash: fetched.content_hash_input,
    status: fetched.status,
    raw_payload: {
      job_id: job.id,
      source: { id: source.id, name: source.name, source_type: source.source_type },
    },
    extracted_payload: fetched.extracted_payload,
    confidence: 0.6,
  };
  const rows = await supabase('/rest/v1/source_records', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  return rows?.[0] ?? null;
}

async function completeJob(job, result) {
  await supabase(`/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'succeeded', result, finished_at: new Date().toISOString(), error_message: null }),
  });
}

async function failJob(job, error) {
  await supabase(`/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed', error_message: error.message, result: { error: error.message }, finished_at: new Date().toISOString() }),
  });
}

export async function runDiscoveryOnce() {
  const job = await claimJob();
  if (!job) return { ok: true, claimed: false };

  try {
    const sourceId = job.payload?.source_id;
    const url = job.payload?.url;
    const source = sourceId ? await getSource(sourceId) : null;
    if (!source || !source.enabled) throw new Error('discovery_source_not_enabled');
    const target = url || source.base_url;
    if (!target) throw new Error('discovery_target_url_missing');

    const fetched = await fetchPublicSource(target, { timeoutMs: source.crawl_policy?.timeout_ms });
    const record = await insertSourceRecord(job, source, fetched);
    await completeJob(job, { source_record_id: record?.id ?? null, source_id: source.id, canonical_url: fetched.canonical_url });
    return { ok: true, claimed: true, job_id: job.id, source_record_id: record?.id ?? null };
  } catch (error) {
    await failJob(job, error);
    return { ok: false, claimed: true, job_id: job.id, error: error.message };
  }
}
