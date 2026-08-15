import crypto from 'node:crypto';

const SECRET = String(process.env.DASHBOARD_ADMIN_SECRET || '');
const COOKIE = 'aqarat_dashboard_session';
const MAX_AGE = 60 * 60 * 8;

function json(res, status, payload) {
  res.status(status).json(payload);
}

function digest() {
  return crypto.createHmac('sha256', SECRET).update('aqarat-dashboard:v1').digest('hex');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function dashboardSessionValid(req) {
  if (!SECRET) return false;
  const cookie = String(req.headers?.cookie || '').split(';').map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE}=`));
  const token = cookie ? decodeURIComponent(cookie.slice(COOKIE.length + 1)) : '';
  return safeEqual(token, digest());
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

  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(digest())}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`);
  return json(res, 200, { ok: true, expires_in: MAX_AGE });
}
