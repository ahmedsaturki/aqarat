import { dashboardSessionValid } from './login.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

function json(res, status, payload) { res.status(status).json(payload); }
const headers = (extra = {}) => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', ...extra });

async function patch(table, id, values) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`${table}_patch_${response.status}`);
  return response.json();
}

async function get(table, id) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&limit=1`, { headers: headers() });
  if (!response.ok) throw new Error(`${table}_get_${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'dashboard_config_missing' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  const action = String(body?.action || '');
  const id = String(body?.id || '');
  try {
    if (!id) return json(res, 422, { error: 'id_required' });

    if (action === 'review_approve' || action === 'review_reject') {
      const current = await get('review_queue', id);
      if (!current) return json(res, 404, { error: 'review_not_found' });
      const decision = action === 'review_approve' ? 'approved' : 'rejected';
      const status = action === 'review_approve' ? 'approved' : 'rejected';
      const updated = await patch('review_queue', id, { status, decision, reviewed_at: new Date().toISOString(), notes: body?.notes ? String(body.notes).slice(0, 2000) : current.notes });
      return json(res, 200, { ok: true, action, updated: updated[0] || null });
    }

    if (action === 'job_retry') {
      const current = await get('jobs', id);
      if (!current) return json(res, 404, { error: 'job_not_found' });
      const attempts = Number(current.attempts || 0);
      const maxAttempts = Number(current.max_attempts || 3);
      if (attempts >= maxAttempts) return json(res, 409, { error: 'max_attempts_reached' });
      const updated = await patch('jobs', id, { status: 'queued', error_message: null, available_at: new Date().toISOString(), locked_at: null, locked_by: null, lease_expires_at: null });
      return json(res, 200, { ok: true, action, updated: updated[0] || null });
    }

    if (action === 'publication_cancel') {
      const current = await get('publication_jobs', id);
      if (!current) return json(res, 404, { error: 'publication_not_found' });
      if (['finished', 'cancelled'].includes(String(current.status))) return json(res, 409, { error: 'publication_terminal' });
      const updated = await patch('publication_jobs', id, { status: 'cancelled', finished_at: new Date().toISOString() });
      return json(res, 200, { ok: true, action, updated: updated[0] || null });
    }

    if (action === 'discovery_toggle') {
      const current = await get('discovery_sources', id);
      if (!current) return json(res, 404, { error: 'discovery_source_not_found' });
      const enabled = body?.enabled === true;
      const updated = await patch('discovery_sources', id, { enabled, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true, action, updated: updated[0] || null });
    }

    if (action === 'lead_status') {
      const current = await get('leads', id);
      if (!current) return json(res, 404, { error: 'lead_not_found' });
      const allowed = new Set(['new','qualified','contacted','meeting','negotiation','won','lost','nurture']);
      const status = String(body?.status || '');
      if (!allowed.has(status)) return json(res, 422, { error: 'invalid_lead_status' });
      const updated = await patch('leads', id, { status, notes: body?.notes ? String(body.notes).slice(0, 4000) : current.notes, updated_at: new Date().toISOString() });
      return json(res, 200, { ok: true, action, updated: updated[0] || null });
    }

    return json(res, 400, { error: 'unsupported_action' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_action_error', action, id, error: error.message }));
    return json(res, 500, { error: 'dashboard_action_failed' });
  }
}
