const ACTIONS = Object.freeze({
  member_invite: 'dashboard.manage.members',
  member_update: 'dashboard.manage.members',
  member_revoke_sessions: 'dashboard.manage.sessions',
});

const ROLES = new Set(['admin', 'operator', 'analyst', 'viewer']);
const MEMBER_STATUSES = new Set(['active', 'suspended', 'removed']);

export function memberActionPermission(action) {
  return ACTIONS[String(action || '').trim()] || null;
}

export function validateMemberAction(action, body = {}) {
  const normalizedAction = String(action || '').trim();
  const permission = memberActionPermission(normalizedAction);
  if (!permission) return { ok: false, error: 'unsupported_member_action' };

  if (normalizedAction === 'member_invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'viewer').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: 'invalid_invitation_email' };
    if (!ROLES.has(role)) return { ok: false, error: 'invalid_invitation_role' };
    return { ok: true, action: normalizedAction, permission, email, role };
  }

  const memberId = String(body.member_id || body.id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return { ok: false, error: 'invalid_member_id' };

  if (normalizedAction === 'member_update') {
    const role = body.role == null ? null : String(body.role).trim().toLowerCase();
    const status = body.status == null ? null : String(body.status).trim().toLowerCase();
    if (role == null && status == null) return { ok: false, error: 'member_change_required' };
    if (role != null && !ROLES.has(role) && role !== 'owner') return { ok: false, error: 'invalid_member_role' };
    if (status != null && !MEMBER_STATUSES.has(status)) return { ok: false, error: 'invalid_member_status' };
    return { ok: true, action: normalizedAction, permission, memberId, role, status };
  }

  const authUserId = String(body.auth_user_id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(authUserId)) return { ok: false, error: 'invalid_auth_user_id' };
  return { ok: true, action: normalizedAction, permission, memberId, authUserId };
}

export const DASHBOARD_MEMBER_ROLES = Object.freeze([...ROLES]);
