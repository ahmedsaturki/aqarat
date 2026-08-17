import { createHash } from 'node:crypto';
import { timedFetch } from '../runtime/http.mjs';
import { safeErrorMessage } from '../runtime/observability.mjs';
import { fetchPublicSource } from './http-adapter.mjs';
import { assertDiscoverySourceAllowed } from './source-policy.mjs';
import { extractCandidates } from './entity-extractor.mjs';
import { aiAvailable } from '../ai/agent-runtime.mjs';
import { runDiscoveryTriageAgent, runPropertyExtractionAgent } from '../ai/agents.mjs';

const SB_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WORKER = process.env.DISCOVERY_WORKER_NAME || `github-discovery-${process.pid}`;
const AI_TIMEOUT_MS = Number(process.env.AI_DISCOVERY_TIMEOUT_MS || 20000);

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
  const response = await timedFetch(`${SB_URL}${path}`, { ...init, headers: authHeaders(init.headers) });
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

async function hasActivePermissionEvidence(sourceId) {
  const result = await sb('/rest/v1/rpc/discovery_source_permission_active', {
    method: 'POST',
    body: JSON.stringify({ p_source_id: sourceId }),
  });
  return result === true;
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

function normalizeAiCandidate(candidate, evidence) {
  if (!candidate || typeof candidate !== 'object') return null;
  const sourceUrl = evidence?.canonical_url || evidence?.source_url || null;
  return {
    entity_type: 'property',
    name: candidate.title || null,
    phone: null,
    email: null,
    address: null,
    city: candidate.city || null,
    source_url: sourceUrl,
    confidence: Number.isFinite(Number(candidate?.confidence)) ? Number(candidate.confidence) : 0.5,
    attributes: {
      property_type: candidate.property_type || null,
      transaction_type: candidate.transaction_type || null,
      district: candidate.district || null,
      area_m2: candidate.area_m2 ?? null,
      price: candidate.price ?? null,
      currency: candidate.currency || 'EGP',
      parcel_number: candidate.parcel_number ?? null,
      bedrooms: candidate.bedrooms ?? null,
      bathrooms: candidate.bathrooms ?? null,
      features: Array.isArray(candidate.features) ? candidate.features : [],
      evidence_spans: Array.isArray(candidate.evidence_spans) ? candidate.evidence_spans : [],
      ai_generated: true,
    },
  };
}

async function aiEnrichEvidence(evidence) {
  if (!aiAvailable()) return { enabled: false, triage: null, extraction: null, candidates: [] };

  try {
    const triage = await runDiscoveryTriageAgent(evidence, { timeoutMs: AI_TIMEOUT_MS });
    if (!triage.enabled || !triage.output) return { enabled: true, triage, extraction: null, candidates: [] };
    if (triage.output.is_listing !== true) return { enabled: true, triage, extraction: null, candidates: [], rejected: true, reason: 'ai_triage_not_listing' };

    let candidates = Array.isArray(triage.output.candidates) ? triage.output.candidates : [];
    let extraction = null;
    if (!candidates.length) {
      extraction = await runPropertyExtractionAgent(evidence, { timeoutMs: AI_TIMEOUT_MS });
      candidates = extraction?.output?.candidates || [];
    }

    return {
      enabled: true,
      triage,
      extraction,
      candidates: candidates.map((candidate) => normalizeAiCandidate(candidate, evidence)).filter(Boolean),
      rejected: false,
    };
  } catch (error) {
    return { enabled: true, triage: null, extraction: null, candidates: [], degraded: true, error: safeErrorMessage(error) };
  }
}

async function insertEntities(job, evidence, candidates, aiMeta = null) {
  if (!candidates.length) return [];
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
    attributes: {
      ...(candidate.attributes || {}),
      ai: aiMeta ? {
        enabled: aiMeta.enabled,
        rejected: Boolean(aiMeta.rejected),
        degraded: Boolean(aiMeta.degraded),
        triage_confidence: aiMeta.triage?.output?.confidence ?? null,
        triage_agent: aiMeta.triage?.agent ?? null,
        extraction_agent: aiMeta.extraction?.agent ?? null,
      } : { enabled: false },
    },
  }));
  const rows = await sb('/rest/v1/discovery_entities?on_conflict=entity_type,external_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows : [];
}

async function materializeEntity(entityId) {
  const rows = await sb('/rest/v1/rpc/materialize_discovery_entity', {
    method: 'POST',
    body: JSON.stringify({ p_entity_id: entityId }),
  });
  return rows ?? null;
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
    const permissionEvidenceActive = await hasActivePermissionEvidence(source.id);
    assertDiscoverySourceAllowed(source, target, permissionEvidenceActive);

    const fetched = await fetchPublicSource(target, {
      timeoutMs: Math.min(Number(source.config?.timeout_ms || 15000), 30000),
    });
    const evidence = await upsertEvidence(job, source, fetched);
    const evidenceInput = evidence ? { ...fetched, ...evidence } : fetched;

    const deterministicCandidates = extractCandidates(evidenceInput);
    const aiResult = await aiEnrichEvidence(evidenceInput);
    const candidates = aiResult.rejected ? [] : (aiResult.candidates.length ? aiResult.candidates : deterministicCandidates);
    const entityRows = await insertEntities(job, evidence, candidates, aiResult);

    const materialized = [];
    for (const entity of entityRows) {
      const result = await materializeEntity(entity.id);
      materialized.push(result);
    }

    await finish(job, {
      status: 'succeeded',
      last_error: null,
      result: {
        evidence_id: evidence?.id ?? null,
        entities_inserted: entityRows.length,
        entities_materialized: materialized.filter((x) => x?.ok).length,
        deterministic_candidates: deterministicCandidates.length,
        ai_candidates: aiResult.candidates.length,
        ai_enabled: aiResult.enabled,
        ai_degraded: Boolean(aiResult.degraded),
        ai_rejected: Boolean(aiResult.rejected),
      },
      finished_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({ ok: true, claimed: true, job_id: job.id, evidence_id: evidence?.id ?? null, entities: entityRows.length, materialized: materialized.length }));
  } catch (error) {
    const attempts = Number(job.attempts || 1);
    const policyError = /^(discovery_source_|discovery_permission_|discovery_https_|discovery_domain_|discovery_url_credentials_forbidden|discovery_target_url_invalid)/.test(String(error.message));
    const retryable = attempts < Number(job.max_attempts || 5) && !policyError;
    await finish(job, {
      status: retryable ? 'queued' : 'failed',
      last_error: safeErrorMessage(error),
      available_at: retryable ? new Date(Date.now() + Math.min(300000, attempts * 30000)).toISOString() : new Date().toISOString(),
      finished_at: retryable ? null : new Date().toISOString(),
    });
    console.error(JSON.stringify({ ok: false, job_id: job.id, error: safeErrorMessage(error), retryable }));
    process.exitCode = 1;
  }
}

await main();
