import { expiredDashboardSessionCookie } from './login.mjs';

function json(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  res.setHeader('Set-Cookie', expiredDashboardSessionCookie());
  res.setHeader('Cache-Control', 'no-store');
  return json(res, 200, { ok: true });
}

export const __private__ = { expiredDashboardSessionCookie };
