import crypto from 'node:crypto';
import { collectDeepHealth } from '../../src/runtime/deep-health.mjs';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function safeEqual(expected, actual) {
  const a = Buffer.from(String(expected || ''));
  const b = Buffer.from(String(actual || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const expected = String(process.env.DASHBOARD_ADMIN_SECRET || '');
  const supplied = String(req.headers['x-aqarat-health-secret'] || '');
  if (!expected || !safeEqual(expected, supplied)) return json(res, 401, { ok: false, error: 'health_auth_required' });

  const health = await collectDeepHealth();
  return json(res, health.ok ? 200 : 503, health);
}
