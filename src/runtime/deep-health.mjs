import { safeErrorMessage } from './observability.mjs';
import { summarizeJobHealth } from './job-health.mjs';

const DEFAULT_TIMEOUT_MS = 8000;

const HEALTH_MAX_OUTPUT_TOKENS = 256;
const DEFAULT_GEMINI_HEALTH_PROBE = 'metadata';

const redactError = safeErrorMessage;

async function timedFetch(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function supabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
  };
}

function retryAfterSeconds(response) {
  const value = response?.headers?.get?.('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(86400, Math.round(seconds));
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.min(86400, Math.ceil((timestamp - Date.now()) / 1000)));
}

async function checkSupabase({ url, serviceKey }) {
  if (!url || !serviceKey) return { status: 'not_configured' };
  try {
    const response = await timedFetch(`${url.replace(/\/$/, '')}/rest/v1/properties?select=id&limit=1`, {
      headers: supabaseHeaders(serviceKey),
    });
    return response.ok ? { status: 'ok' } : { status: 'error', code: response.status };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

async function checkTelegram({ token, publicBaseUrl }) {
  if (!token || !publicBaseUrl) return { status: 'not_configured' };
  try {
    const base = `https://api.telegram.org/bot${token}`;
    const [meResponse, webhookResponse] = await Promise.all([
      timedFetch(`${base}/getMe`, { method: 'POST' }),
      timedFetch(`${base}/getWebhookInfo`, { method: 'POST' }),
    ]);
    const me = await meResponse.json().catch(() => null);
    const webhook = await webhookResponse.json().catch(() => null);
    const expectedUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/telegram/update`;
    const actualUrl = webhook?.result?.url || '';
    const botOk = Boolean(meResponse.ok && me?.ok === true);
    const webhookOk = Boolean(webhookResponse.ok && webhook?.ok === true && actualUrl === expectedUrl);
    return {
      status: botOk && webhookOk ? 'ok' : botOk ? 'degraded' : 'error',
      bot: botOk ? 'ok' : 'error',
      webhook: webhookOk ? 'ok' : 'mismatch',
      pending_updates: webhook?.result?.pending_update_count ?? null,
      last_error: webhook?.result?.last_error_message ?? null,
    };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

async function checkGemini({ apiKey, model, baseUrl, probe = DEFAULT_GEMINI_HEALTH_PROBE }) {
  if (!apiKey || !model || !baseUrl) return { status: 'not_configured' };
  try {
    const root = baseUrl.replace(/\/$/, '');
    const modelEndpoint = `${root}/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
    const metadataResponse = await timedFetch(modelEndpoint);
    const metadata = await metadataResponse.json().catch(() => null);
    if (!metadataResponse.ok) {
      const retryAfter = retryAfterSeconds(metadataResponse);
      return retryAfter === null
        ? { status: 'error', code: metadataResponse.status }
        : { status: 'error', code: metadataResponse.status, retry_after_seconds: retryAfter };
    }

    const supportedMethods = Array.isArray(metadata?.supportedGenerationMethods)
      ? metadata.supportedGenerationMethods
      : [];
    if (!supportedMethods.includes('generateContent')) {
      return { status: 'degraded', model, error: 'generate_content_not_supported' };
    }
    if (probe !== 'generation') return { status: 'ok', model, probe: 'metadata' };

    const endpoint = `${root}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await timedFetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Return only the requested JSON.' }] },
        contents: [{ role: 'user', parts: [{ text: 'Return {"ok":true}.' }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: HEALTH_MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
          },
        },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const retryAfter = retryAfterSeconds(response);
      return retryAfter === null
        ? { status: 'error', code: response.status }
        : { status: 'error', code: response.status, retry_after_seconds: retryAfter };
    }
    const parts = payload?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((part) => part?.text || '').join('') : '';
    const finishReason = payload?.candidates?.[0]?.finishReason || null;
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    return parsed?.ok === true
      ? { status: 'ok', model, probe: 'generation', response_chars: text.length }
      : { status: 'degraded', model, probe: 'generation', response_chars: text.length, finish_reason: finishReason, error: 'unexpected_response' };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

async function checkSheetsQueue({ supabaseUrl, serviceKey }) {
  if (!supabaseUrl || !serviceKey) return { status: 'not_configured' };
  try {
    const response = await timedFetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/jobs?select=status,attempts,max_attempts,available_at,started_at,lease_expires_at,created_at,updated_at&job_type=eq.google_sheets_projection&status=in.(queued,running,failed)&order=updated_at.asc&limit=500`,
      { headers: supabaseHeaders(serviceKey) },
    );
    if (!response.ok) return { status: 'error', code: response.status };
    const rows = await response.json();
    const metrics = summarizeJobHealth(rows);
    return { status: metrics.status, pending_jobs: metrics.queued_jobs + metrics.running_jobs, metrics };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

export async function collectDeepHealth(env = process.env) {
  const [supabase, telegram, gemini, sheets] = await Promise.all([
    checkSupabase({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
    checkTelegram({ token: env.TELEGRAM_BOT_TOKEN, publicBaseUrl: env.PUBLIC_BASE_URL }),
    checkGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-3.6-flash', baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta', probe: env.GEMINI_HEALTH_PROBE || DEFAULT_GEMINI_HEALTH_PROBE }),
    checkSheetsQueue({ supabaseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
  ]);

  const components = { supabase, telegram, gemini, google_sheets: sheets };
  const statuses = Object.values(components).map((value) => value.status);
  const ok = statuses.every((status) => status === 'ok' || status === 'not_configured');
  const configuredComponents = statuses.filter((status) => status !== 'not_configured').length;
  const healthyComponents = statuses.filter((status) => status === 'ok').length;

  return {
    ok,
    status: ok ? 'ok' : 'degraded',
    release: String(env.VERCEL_GIT_COMMIT_SHA || env.GIT_COMMIT_SHA || '').trim() || null,
    checked_at: new Date().toISOString(),
    summary: { configured_components: configuredComponents, healthy_components: healthyComponents, total_components: statuses.length },
    components,
  };
}
