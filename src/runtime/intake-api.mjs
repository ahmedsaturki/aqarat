import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { telegramUpdateToIntakeEvent } from '../adapters/telegram.mjs';
import { MAX_BODY_BYTES } from './runtime-config.mjs';

const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const INTAKE_WEBHOOK_SECRET = process.env.INTAKE_WEBHOOK_SECRET || '';

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function safeEqual(expected, actual) {
  const a = Buffer.from(String(expected || ''));
  const b = Buffer.from(String(actual || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function authorizedIntake(req) {
  return Boolean(INTAKE_WEBHOOK_SECRET) && safeEqual(INTAKE_WEBHOOK_SECRET, req.headers['x-aqarat-intake-secret']);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      try {
        settled = true;
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        fail(new Error('invalid_json'));
      }
    });

    req.on('error', fail);
  });
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
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    const error = new Error(`supabase_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function findExistingIntakeEvent(event) {
  if (!event.external_event_id) return null;
  const existing = await supabase(`/rest/v1/intake_events?channel=eq.${encodeURIComponent(event.channel)}&external_event_id=eq.${encodeURIComponent(event.external_event_id)}&select=id,status,parsed_payload,raw_text&limit=1`);
  return existing?.[0] ?? null;
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

function authorizedTelegram(req) {
  return Boolean(TELEGRAM_WEBHOOK_SECRET) && safeEqual(TELEGRAM_WEBHOOK_SECRET, req.headers['x-telegram-bot-api-secret-token']);
}

async function handle(req, res) {
  if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true, service: 'aqarat-intake', version: 'v1' });

  if (req.method !== 'POST' || !['/intake', '/telegram/update'].includes(req.url)) return json(res, 404, { ok: false, error: 'not_found' });

  if (req.url === '/intake' && !authorizedIntake(req)) return json(res, 401, { ok: false, error: 'intake_unauthorized' });
  if (req.url === '/telegram/update' && !authorizedTelegram(req)) return json(res, 401, { ok: false, error: 'telegram_webhook_unauthorized' });

  try {
    const payload = await readBody(req);
    const event = req.url === '/telegram/update' ? telegramUpdateToIntakeEvent(payload) : payload;
    if (!event?.raw_text || !event?.channel) return json(res, 422, { ok: false, error: 'invalid_intake_contract' });

    const stored = await persistIntakeEvent(event);
    const result = await commitIntakeEvent(stored.id);
    return json(res, 200, { ok: true, intake_event_id: stored.id, result });
  } catch (error) {
    const status = error.status === 401 || error.status === 403 ? 502 : 500;
    console.error(JSON.stringify({ event: 'intake_error', error: error.message }));
    return json(res, status, { ok: false, error: status === 502 ? 'upstream_unavailable' : 'internal_error' });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => json(res, 500, { ok: false, error: 'internal_error' }));
});

server.listen(PORT, '0.0.0.0', () => console.log(`Aqarat intake runtime listening on :${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
