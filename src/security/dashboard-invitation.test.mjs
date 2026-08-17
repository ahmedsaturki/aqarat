import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedInvitationExpiry, createInvitationToken, digestInvitationToken, invitationDigestMatches, invitationLimits, invitationUsable } from './dashboard-invitation.mjs';

test('invitation token is high entropy and only its digest is persisted', () => {
  const result = createInvitationToken(() => Buffer.alloc(invitationLimits.tokenBytes, 7));
  assert.equal(result.token.length > 20, true);
  assert.equal(result.digest, digestInvitationToken(result.token));
  assert.notEqual(result.token, result.digest);
  assert.equal(invitationDigestMatches(result.token, result.digest), true);
  assert.equal(invitationDigestMatches('other-token', result.digest), false);
});

test('invitation expiry is bounded', () => {
  const now = new Date('2026-08-17T00:00:00.000Z');
  assert.equal(boundedInvitationExpiry(now, 59), null);
  assert.equal(boundedInvitationExpiry(now, invitationLimits.maxTtlSeconds + 1), null);
  assert.equal(boundedInvitationExpiry(now, 3600), '2026-08-17T01:00:00.000Z');
});

test('invitation usability rejects accepted, revoked and expired records', () => {
  const now = new Date('2026-08-17T00:00:00.000Z');
  const base = { expires_at: '2026-08-17T01:00:00.000Z' };
  assert.equal(invitationUsable(base, now), true);
  assert.equal(invitationUsable({ ...base, accepted_at: '2026-08-17T00:10:00.000Z' }, now), false);
  assert.equal(invitationUsable({ ...base, revoked_at: '2026-08-17T00:10:00.000Z' }, now), false);
  assert.equal(invitationUsable({ expires_at: '2026-08-16T23:59:59.000Z' }, now), false);
});
