const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function telegram(method, body = {}) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN_not_configured');
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
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
  if (!TOKEN) return json(res, 503, { ok: false, token_configured: false, webhook_secret_configured: Boolean(WEBHOOK_SECRET), error: 'TELEGRAM_BOT_TOKEN_not_configured' });

  try {
    const base = `https://${req.headers.host}/api/telegram/update`;
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
      token_configured: true,
      webhook_secret_configured: Boolean(WEBHOOK_SECRET),
      bot: {
        id: me?.result?.id ?? null,
        username: me?.result?.username ?? null,
        first_name: me?.result?.first_name ?? null,
      },
      webhook: {
        expected_url: base,
        url: after?.result?.url || '',
        pending_update_count: after?.result?.pending_update_count ?? 0,
        last_error_date: after?.result?.last_error_date ?? null,
        last_error_message: after?.result?.last_error_message ?? null,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'telegram_status_error', error: error.message, body: error.body ?? null }));
    return json(res, 502, { ok: false, token_configured: true, error: error.message, telegram: error.body ?? null });
  }
}
