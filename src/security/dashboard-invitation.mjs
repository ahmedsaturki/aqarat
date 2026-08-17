import crypto from 'node:crypto';

const TOKEN_BYTES = 32;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 14;

export function createInvitationToken(randomBytes = crypto.randomBytes) {
  const raw = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token: raw, digest: digestInvitationToken(raw) };
}

export function digestInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

export function boundedInvitationExpiry(now = new Date(), ttlSeconds = 60 * 60 * 24 * 7) {
  const ttl = Number(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl < 60 || ttl > MAX_TTL_SECONDS) return null;
  return new Date(new Date(now).getTime() + ttl * 1000).toISOString();
}

export function invitationUsable(invitation, now = new Date()) {
  if (!invitation || invitation.accepted_at || invitation.revoked_at) return false;
  const expiry = Date.parse(String(invitation.expires_at || ''));
  return Number.isFinite(expiry) && expiry > new Date(now).getTime();
}

export function invitationDigestMatches(token, storedDigest) {
  const actual = Buffer.from(digestInvitationToken(token));
  const expected = Buffer.from(String(storedDigest || ''));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export const invitationLimits = Object.freeze({ tokenBytes: TOKEN_BYTES, maxTtlSeconds: MAX_TTL_SECONDS });
