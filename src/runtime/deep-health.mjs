const DEFAULT_TIMEOUT_MS = 8000;

function redactError(error) {
  const message = error?.message || String(error);
  return message
    .replace(/key=[^\s&]+/gi, 'key=[redacted]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .slice(0, 240);
}

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

async function checkGemini({ apiKey, model, baseUrl }) {
  if (!apiKey || !model || !baseUrl) return { status: 'not_configured' };
  try {
    const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await timedFetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Aqarat health check. Reply with OK.' }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { status: 'error', code: response.status };
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { status: text ? 'ok' : 'degraded', model, response_chars: text.length };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

async function checkSheetsQueue({ supabaseUrl, serviceKey }) {
  if (!supabaseUrl || !serviceKey) return { status: 'not_configured' };
  try {
    const response = await timedFetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/jobs?select=id&job_type=eq.google_sheets_projection&status=in.(queued,running)&limit=100`,
      { headers: supabaseHeaders(serviceKey) },
    );
    if (!response.ok) return { status: 'error', code: response.status };
    const rows = await response.json();
    return { status: 'ok', pending_jobs: Array.isArray(rows) ? rows.length : 0 };
  } catch (error) {
    return { status: 'error', error: redactError(error) };
  }
}

export async function collectDeepHealth(env = process.env) {
  const [supabase, telegram, gemini, sheets] = await Promise.all([
    checkSupabase({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
    checkTelegram({ token: env.TELEGRAM_BOT_TOKEN, publicBaseUrl: env.PUBLIC_BASE_URL }),
    checkGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-3.6-flash', baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta' }),
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
