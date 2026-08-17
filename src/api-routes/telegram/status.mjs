import { timedFetch } from '../../runtime/http.mjs';
import { safeErrorMessage } from '../../runtime/observability.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const ADMIN_SECRET = process.env.TELEGRAM_ADMIN_STATUS_SECRET || '';
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function safeEqual(expected, actual) {
  const a = Buffer.from(String(expected || ''));
  const b = Buffer.from(String(actual || ''));
  if (!a.length || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function authorized(req) {
  if (!ADMIN_SECRET) return false;
  return safeEqual(ADMIN_SECRET, req.headers['x-aqarat-telegram-admin-secret']);
}

async function telegram(method, body = {}) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN_not_configured');
  const response = await timedFetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    const error = new Error(`telegram_api_${response.status}`);
    error.body = payload;
    throw error;
  }
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!authorized(req)) return json(res, 401, { ok: false, error: 'admin_unauthorized' });
  if (!TOKEN) return json(res, 503, { ok: false, error: 'TELEGRAM_BOT_TOKEN_not_configured' });
  if (!PUBLIC_BASE_URL) return json(res, 503, { ok: false, error: 'PUBLIC_BASE_URL_not_configured' });

  try {
    const base = `${PUBLIC_BASE_URL}/api/telegram/update`;
    const me = await telegram('getMe');
    const before = await telegram('getWebhookInfo');
    const configuredUrl = before?.result?.url || '';

    if (configuredUrl !== base) {
      await telegram('setWebhook', {
        url: base,
        ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
        allowed_updates: ['message', 'edited_message', 'channel_post'],
        drop_pending_updates: false,
      });
    }

    const after = await telegram('getWebhookInfo');
    return json(res, 200, {
      ok: true,
      webhook: {
        configured: (after?.result?.url || '') === base,
        pending_update_count: after?.result?.pending_update_count ?? 0,
        last_error_date: after?.result?.last_error_date ?? null,
        last_error_message: after?.result?.last_error_message ?? null,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'telegram_status_error', error: safeErrorMessage(error) }));
    return json(res, 502, { ok: false, error: 'telegram_upstream_unavailable' });
  }
}
