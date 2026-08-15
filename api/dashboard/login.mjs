import crypto from 'node:crypto';

const SECRET = String(process.env.DASHBOARD_ADMIN_SECRET || '');
const COOKIE = 'aqarat_dashboard_session';
const MAX_AGE = 60 * 60 * 8;

function json(res, status, payload) {
  res.status(status).json(payload);
}

function signature(payload) {
  return crypto.createHmac('sha256', SECRET).update(`aqarat-dashboard:v2:${payload}`).digest('hex');
}

function sessionToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(18).toString('base64url')}`;
  return `${payload}.${signature(payload)}`;
}

function sessionDetails(req) {
  if (!SECRET) return null;
  const cookie = String(req.headers?.cookie || '').split(';').map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE}=`));
  const token = cookie ? decodeURIComponent(cookie.slice(COOKIE.length + 1)) : '';
  const [issuedAt, nonce, suppliedSignature, ...rest] = token.split('.');
  const payload = `${issuedAt || ''}.${nonce || ''}`;
  if (rest.length || !issuedAt || !nonce || !suppliedSignature || !safeEqual(suppliedSignature, signature(payload))) return null;
  const ageMs = Date.now() - Number(issuedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_AGE * 1000) return null;
  return { actorId: `dashboard-session:${crypto.createHash('sha256').update(nonce).digest('hex').slice(0, 16)}` };
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function dashboardSessionValid(req) {
  return Boolean(sessionDetails(req));
}

export function dashboardSessionActor(req) {
  return sessionDetails(req)?.actorId || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!SECRET) return json(res, 503, { error: 'dashboard_secret_not_configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const password = String(body?.password || '');
  if (!safeEqual(password, SECRET)) return json(res, 401, { error: 'invalid_credentials' });

  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sessionToken())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`);
  return json(res, 200, { ok: true, expires_in: MAX_AGE });
}
