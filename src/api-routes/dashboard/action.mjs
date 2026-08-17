import crypto from 'node:crypto';
import { timedFetch } from '../../runtime/http.mjs';
import { requireDashboardPermission } from '../../security/dashboard-rbac.mjs';
import { resolveDashboardAccess } from '../../security/dashboard-access.mjs';
import { safeErrorMessage } from '../../runtime/observability.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

function json(res, status, payload) { res.status(status).json(payload); }
const headers = (extra = {}) => ({ apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json', ...extra });

async function applyPropertyMutation(payload) {
  const response = await timedFetch(`${SUPABASE_URL}/rest/v1/rpc/dashboard_apply_property_mutation`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const error = new Error(`dashboard_property_mutation_rpc_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function applyAction(payload) {
  const response = await timedFetch(`${SUPABASE_URL}/rest/v1/rpc/dashboard_apply_action`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const error = new Error(`dashboard_action_rpc_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function trustedDashboardOrigin(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const origin = String(req.headers?.origin || '').replace(/\/$/, '');
  return Boolean(configured && origin && origin === configured);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const access = await resolveDashboardAccess(req);
  if (!access.ok) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!trustedDashboardOrigin(req)) return json(res, 403, { error: 'dashboard_origin_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'dashboard_config_missing' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  const action = String(body?.action || '');
  const id = String(body?.id || '');
  try {
    const propertyActions = new Set(['property_create', 'property_update', 'property_archive']);
    if (propertyActions.has(action)) {
      if (!requireDashboardPermission(access, 'dashboard.action.properties').ok) return json(res, 403, { error: 'dashboard_permission_required' });
      const mutationAction = action.slice('property_'.length);
      if (mutationAction !== 'create' && !id) return json(res, 422, { error: 'id_required' });
      const result = await applyPropertyMutation({
        p_action: mutationAction,
        p_property_id: mutationAction === 'create' ? null : (id || null),
        p_changes: body?.changes && typeof body.changes === 'object' ? body.changes : {},
        p_actor_id: access.actorId,
      });
      if (!result?.ok) return json(res, 409, result || { error: 'property_mutation_rejected' });
      return json(res, 200, result);
    }

    if (!id) return json(res, 422, { error: 'id_required' });
    const actionPermissions = {
      review_approve: 'dashboard.action.review',
      review_reject: 'dashboard.action.review',
      job_retry: 'dashboard.action.jobs',
      publication_cancel: 'dashboard.action.publications',
      discovery_toggle: 'dashboard.action.discovery',
      lead_status: 'dashboard.action.leads',
    };
    const permission = actionPermissions[action];
    if (!permission) return json(res, 400, { error: 'unsupported_action' });
    if (!requireDashboardPermission(access, permission).ok) return json(res, 403, { error: 'dashboard_permission_required' });
    const result = await applyAction({
      p_action: action,
      p_entity_id: id,
      p_notes: body?.notes ? String(body.notes).slice(0, 4000) : null,
      p_enabled: action === 'discovery_toggle' ? body?.enabled === true : null,
      p_status: action === 'lead_status' ? String(body?.status || '') : null,
      p_actor_id: access.actorId,
      p_correlation_id: crypto.randomUUID(),
    });
    if (!result?.ok) return json(res, 409, result || { error: 'dashboard_action_rejected' });
    return json(res, 200, result);
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_action_error', action, id, error: safeErrorMessage(error) }));
    const status = error.status === 400 ? 409 : 500;
    return json(res, status, { error: 'dashboard_action_failed' });
  }
}
