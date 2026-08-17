import test from 'node:test';
import assert from 'node:assert/strict';
import { memberActionPermission, validateMemberAction } from './dashboard-member-actions.mjs';

test('member actions map to explicit permissions', () => {
  assert.equal(memberActionPermission('member_invite'), 'dashboard.manage.members');
  assert.equal(memberActionPermission('member_revoke_sessions'), 'dashboard.manage.sessions');
  assert.equal(memberActionPermission('unknown'), null);
});

test('invitation validation normalizes email and role', () => {
  assert.deepEqual(validateMemberAction('member_invite', { email: ' Admin@Example.com ', role: 'ADMIN' }), {
    ok: true,
    action: 'member_invite',
    permission: 'dashboard.manage.members',
    email: 'admin@example.com',
    role: 'admin',
  });
});

test('invitation rejects invalid email and role', () => {
  assert.equal(validateMemberAction('member_invite', { email: 'not-an-email', role: 'viewer' }).ok, false);
  assert.equal(validateMemberAction('member_invite', { email: 'a@example.com', role: 'owner' }).error, 'invalid_invitation_role');
});

test('member update requires a UUID and at least one allowed change', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(validateMemberAction('member_update', { member_id: id }).error, 'member_change_required');
  assert.equal(validateMemberAction('member_update', { member_id: id, status: 'unknown' }).error, 'invalid_member_status');
  assert.equal(validateMemberAction('member_update', { member_id: id, role: 'operator', status: 'suspended' }).ok, true);
});

test('session revocation requires the target auth user UUID', () => {
  const memberId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  assert.equal(validateMemberAction('member_revoke_sessions', { member_id: memberId }).error, 'invalid_auth_user_id');
  assert.equal(validateMemberAction('member_revoke_sessions', { member_id: memberId, auth_user_id: userId }).ok, true);
});
