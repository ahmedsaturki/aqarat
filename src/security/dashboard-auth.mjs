import { timedFetch } from '../runtime/http.mjs';
import { resolveDashboardMemberAccess } from './dashboard-rbac.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const AUTH_HEADER = 'authorization';

function bearerToken(req) {
  const raw = String(req?.headers?.[AUTH_HEADER] || req?.headers?.Authorization || '');
  const match = raw.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

function serviceHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, 'content-type': 'application/json', ...extra };
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function supabaseAuthUser(token) {
  if (!SUPABASE_URL || !SERVICE_KEY || !token) return null;
  const response = await timedFetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: serviceHeaders({ authorization: `Bearer ${token}` }),
  });
  if (!response.ok) return null;
  const user = await readJson(response);
  return user?.id && typeof user.id === 'string' ? user : null;
}

async function activeMembership(userId, workspaceId = '') {
  const filter = new URLSearchParams({
    auth_user_id: `eq.${userId}`,
    status: 'eq.active',
    select: 'workspace_id,auth_user_id,role,status',
    limit: '1',
  });
  if (workspaceId) filter.set('workspace_id', `eq.${workspaceId}`);
  const response = await timedFetch(`${SUPABASE_URL}/rest/v1/dashboard_members?${filter}`, {
    headers: serviceHeaders({ authorization: `Bearer ${SERVICE_KEY}` }),
  });
  if (!response.ok) return null;
  const rows = await readJson(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function resolveSupabaseDashboardAccess(req, options = {}) {
  const token = bearerToken(req);
  if (!token) return { ok: false, reason: 'dashboard_auth_required' };
  const user = await (options.authUser || supabaseAuthUser)(token);
  if (!user?.id) return { ok: false, reason: 'dashboard_auth_required' };
  const workspaceId = String(options.workspaceId || req?.headers?.['x-dashboard-workspace'] || '').trim();
  const membership = await (options.membership || ((userId, selectedWorkspace) => activeMembership(userId, selectedWorkspace)))(user.id, workspaceId);
  const access = resolveDashboardMemberAccess(membership);
  return access.ok ? { ...access, emailVerified: user.email_confirmed_at != null } : access;
}

export function hasSupabaseBearerToken(req) {
  return Boolean(bearerToken(req));
}
