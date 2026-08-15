import { URL } from 'node:url';
import crypto from 'node:crypto';
import { dashboardSessionValid } from './login.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const MAX_URL_LENGTH = 2048;

function json(res, status, payload) {
  res.status(status).json(payload);
}

function headers() {
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
}

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return body;
}

function sourceHost(source) {
  try { return new URL(source.base_url).hostname.toLowerCase(); } catch { return ''; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'supabase_dashboard_config_missing' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const sourceId = String(body?.source_id || '');
  const rawUrl = String(body?.url || '').trim();
  if (!sourceId || !rawUrl || rawUrl.length > MAX_URL_LENGTH) return json(res, 400, { error: 'source_id_and_valid_url_required' });

  let target;
  try { target = new URL(rawUrl); } catch { return json(res, 400, { error: 'invalid_url' }); }
  if (target.protocol !== 'https:') return json(res, 400, { error: 'https_required' });
  if (target.username || target.password) return json(res, 400, { error: 'url_credentials_forbidden' });

  try {
    const sources = await sb(`/rest/v1/discovery_sources?id=eq.${encodeURIComponent(sourceId)}&select=id,key,name,base_url,policy_mode,config,enabled&limit=1`);
    const source = sources?.[0];
    if (!source) return json(res, 404, { error: 'source_not_found' });

    // Manual-assisted mode is an explicit operator action over a public URL.
    // It never bypasses authentication, CAPTCHA, robots, rate limits, or site controls.
    if (String(source.policy_mode) !== 'manual_assisted') return json(res, 409, { error: 'source_not_manual_assisted' });
    if (sourceHost(source) !== target.hostname.toLowerCase()) return json(res, 400, { error: 'url_outside_source_domain' });

    const run = await sb('/rest/v1/discovery_runs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ source_id: source.id, status: 'queued', query: target.href, city: 'Sadat City', country: 'Egypt', stats: { mode: 'manual_operator_assisted' } }),
    });
    const runRow = Array.isArray(run) ? run[0] : run;
    const job = await sb('/rest/v1/discovery_jobs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        run_id: runRow.id,
        job_type: 'fetch_url',
        payload: { source_id: source.id, url: target.href, mode: 'manual_operator_assisted' },
        status: 'queued', priority: 100, attempts: 0, max_attempts: 3,
        available_at: new Date().toISOString(),
      }),
    });

    await sb('/rest/v1/audit_events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'discovery_manual_submit', entity_type: 'discovery_run', entity_id: runRow.id,
        actor_type: 'dashboard_operator', actor_id: 'operator-session',
        payload: { source_id: source.id, source_key: source.key, url_host: target.hostname, mode: 'manual_operator_assisted' },
      }),
    }).catch(() => null);

    return json(res, 202, { ok: true, run_id: runRow.id, job_id: (Array.isArray(job) ? job[0]?.id : job?.id) ?? null });
  } catch (error) {
    return json(res, 500, { error: 'discovery_manual_submit_failed', correlation_id: crypto.randomUUID() });
  }
}
