import { telegramUpdateToIntakeEvent } from '../adapters/telegram.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 256 * 1024);
const OUTBOUND_TIMEOUT_MS = Math.max(1000, Number(process.env.OUTBOUND_TIMEOUT_MS || 15000));

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeout = new Error('outbound_request_timeout');
      timeout.code = 'TIMEOUT';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function requireConfig() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL_required');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_required');
}

async function supabase(path, options = {}) {
  requireConfig();
  const response = await timedFetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`supabase_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function findExisting(event) {
  if (!event.external_event_id) return null;
  const rows = await supabase(
    `/rest/v1/intake_events?channel=eq.${encodeURIComponent(event.channel)}&external_event_id=eq.${encodeURIComponent(event.external_event_id)}&select=id,status,parsed_payload,raw_text&limit=1`,
  );
  return rows?.[0] ?? null;
}

async function persist(event) {
  const existing = await findExisting(event);
  if (existing) return existing;
  try {
    const rows = await supabase('/rest/v1/intake_events', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        channel: event.channel,
        external_event_id: event.external_event_id,
        sender_id: event.sender_id,
        chat_id: event.chat_id,
        raw_text: event.raw_text,
        parsed_payload: event.parsed_payload,
        status: 'received',
      }),
    });
    if (Array.isArray(rows) && rows[0]?.id) return rows[0];
  } catch (error) {
    if (error.status !== 409) throw error;
    const raced = await findExisting(event);
    if (raced) return raced;
    throw error;
  }
  throw new Error('intake_event_persisted_but_not_returned');
}

async function commit(eventId) {
  return supabase('/rest/v1/rpc/commit_intake_event', {
    method: 'POST',
    body: JSON.stringify({ p_event_id: eventId }),
  });
}

function authorized(headers = {}) {
  if (!TELEGRAM_WEBHOOK_SECRET) return true;
  return headers['x-telegram-bot-api-secret-token'] === TELEGRAM_WEBHOOK_SECRET;
}

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN_not_configured');
  const response = await timedFetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok || payload?.ok === false) {
    const error = new Error(`telegram_api_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function processTelegramUpdate(payload, headers = {}) {
  if (!authorized(headers)) {
    return { ok: false, status: 401, error: 'telegram_webhook_unauthorized' };
  }
  const event = telegramUpdateToIntakeEvent(payload);
  const stored = await persist(event);
  const result = await commit(stored.id);

  let acknowledgement = { sent: false };
  if (TELEGRAM_BOT_TOKEN && event.chat_id) {
    try {
      await telegramApi('sendMessage', {
        chat_id: event.chat_id,
        text: '✅ وصلت رسالتك. تم تسجيل البيانات وبدء المعالجة في Aqarat OS.',
      });
      acknowledgement = { sent: true };
    } catch (error) {
      acknowledgement = { sent: false, error: error.message };
    }
  }

  return {
    ok: true,
    status: 200,
    intake_event_id: stored.id,
    result,
    acknowledgement,
  };
}

export async function getTelegramStatus({ autoRegister = true, webhookUrl } = {}) {
  const status = {
    token_configured: Boolean(TELEGRAM_BOT_TOKEN),
    webhook_secret_configured: Boolean(TELEGRAM_WEBHOOK_SECRET),
    max_body_bytes: MAX_BODY_BYTES,
  };
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, ...status, error: 'TELEGRAM_BOT_TOKEN_not_configured' };

  const me = await telegramApi('getMe', {});
  const webhook = await telegramApi('getWebhookInfo', {});
  status.bot = {
    id: me?.result?.id ?? null,
    username: me?.result?.username ?? null,
    first_name: me?.result?.first_name ?? null,
  };
  status.webhook_before = {
    url: webhook?.result?.url ?? '',
    pending_update_count: webhook?.result?.pending_update_count ?? 0,
    last_error_date: webhook?.result?.last_error_date ?? null,
    last_error_message: webhook?.result?.last_error_message ?? null,
  };

  if (autoRegister && webhookUrl && webhook?.result?.url !== webhookUrl) {
    await telegramApi('setWebhook', {
      url: webhookUrl,
      ...(TELEGRAM_WEBHOOK_SECRET ? { secret_token: TELEGRAM_WEBHOOK_SECRET } : {}),
      allowed_updates: ['message', 'edited_message', 'channel_post'],
      drop_pending_updates: false,
    });
    const after = await telegramApi('getWebhookInfo', {});
    status.webhook_after = {
      url: after?.result?.url ?? '',
      pending_update_count: after?.result?.pending_update_count ?? 0,
      last_error_date: after?.result?.last_error_date ?? null,
      last_error_message: after?.result?.last_error_message ?? null,
    };
  }

  return { ok: true, ...status };
}
