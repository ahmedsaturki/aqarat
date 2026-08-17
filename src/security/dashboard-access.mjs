import { dashboardSessionActor } from '../api-routes/dashboard/login.mjs';
import { resolveSupabaseDashboardAccess } from './dashboard-auth.mjs';
import { resolveLegacyDashboardAccess } from './dashboard-rbac.mjs';

export async function resolveDashboardAccess(req, options = {}) {
  const mode = String(options.mode ?? process.env.DASHBOARD_AUTH_MODE ?? 'legacy').trim().toLowerCase();
  if (mode === 'supabase') return resolveSupabaseDashboardAccess(req, options);
  if (mode !== 'legacy') return { ok: false, reason: 'dashboard_auth_mode_invalid' };
  return resolveLegacyDashboardAccess(dashboardSessionActor(req));
}

export function dashboardAuthMode(options = {}) {
  return String(options.mode ?? process.env.DASHBOARD_AUTH_MODE ?? 'legacy').trim().toLowerCase();
}
