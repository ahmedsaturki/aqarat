import { telegramUpdateToIntakeEvent } from '../adapters/telegram.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 256 * 1024);

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', String(Buffer.byteLength(body)));
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function requireRuntimeConfig() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL_required');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_required');
}

async function supabase(path, options = {}) {
  requireRuntimeConfig();
  const response = await fetch(`${SUPABASE_URL}${path}`, {
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
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const error = new Error(`supabase_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        finish(reject, new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        finish(resolve, raw ? JSON.parse(raw) : {});
      } catch {
        finish(reject, new Error('invalid_json'));
      }
    });

    req.on('error', (error) => finish(reject, error));
  });
}

async function findExistingIntakeEvent(event) {
  if (!event.external_event_id) return null;
  const rows = await supabase(
    `/rest/v1/intake_events?channel=eq.${encodeURIComponent(event.channel)}&external_event_id=eq.${encodeURIComponent(event.external_event_id)}&select=id,status,parsed_payload,raw_text&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

async function persistIntakeEvent(event) {
  const existing = await findExistingIntakeEvent(event);
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
    const raced = await findExistingIntakeEvent(event);
    if (raced) return raced;
    throw error;
  }

  throw new Error('intake_event_persisted_but_not_returned');
}

async function commitIntakeEvent(eventId) {
  return supabase('/rest/v1/rpc/commit_intake_event', {
    method: 'POST',
    body: JSON.stringify({ p_event_id: eventId }),
  });
}

async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || chatId == null) return { sent: false, reason: 'telegram_bot_not_configured' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      return { sent: false, reason: 'telegram_send_failed' };
    }
    return { sent: true };
  } catch {
    return { sent: false, reason: 'telegram_send_error' };
  }
}

function authorizedTelegram(req) {
  if (!TELEGRAM_WEBHOOK_SECRET) return true;
  return req.headers['x-telegram-bot-api-secret-token'] === TELEGRAM_WEBHOOK_SECRET;
}

async function processEvent(event) {
  if (!event?.raw_text || !event?.channel) {
    const error = new Error('invalid_intake_contract');
    error.status = 422;
    throw error;
  }

  const stored = await persistIntakeEvent(event);
  const result = await commitIntakeEvent(stored.id);

  return {
    ok: true,
    intake_event_id: stored.id,
    result,
  };
}

export async function handleHealth(_req, res) {
  return json(res, 200, {
    ok: true,
    service: 'aqarat-intake',
    version: 'v1',
    telegram_token_configured: Boolean(TELEGRAM_BOT_TOKEN),
  });
}

export async function handleIntake(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const payload = await readBody(req);
    const result = await processEvent(payload);
    return json(res, 200, result);
  } catch (error) {
    const status = error.status === 422 ? 422 : error.status === 401 || error.status === 403 ? 502 : 500;
    console.error(JSON.stringify({
      event: 'intake_error',
      error: error.message,
      body: error.body ?? null,
    }));
    return json(res, status, { ok: false, error: error.message });
  }
}

export async function handleTelegramUpdate(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!authorizedTelegram(req)) {
    return json(res, 401, { ok: false, error: 'telegram_webhook_unauthorized' });
  }

  try {
    const payload = await readBody(req);
    const event = telegramUpdateToIntakeEvent(payload);
    const result = await processEvent(event);
    const acknowledgement = await sendTelegramMessage(
      event.chat_id,
      '✅ وصلت رسالتك. تم تسجيل البيانات وبدء المعالجة في Aqarat OS.',
    );
    return json(res, 200, { ...result, acknowledgement });
  } catch (error) {
    const status = error.status === 422 ? 422 : error.status === 401 || error.status === 403 ? 502 : 500;
    console.error(JSON.stringify({
      event: 'telegram_intake_error',
      error: error.message,
      body: error.body ?? null,
    }));
    return json(res, status, { ok: false, error: error.message });
  }
}
