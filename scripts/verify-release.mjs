import process from 'node:process';
import { timedFetch } from '../src/runtime/http.mjs';

const baseUrl = String(process.argv[2] || process.env.AQARAT_RELEASE_URL || '').replace(/\/$/, '');
const expectedSha = String(process.env.EXPECTED_GIT_SHA || '').trim();
const requestTimeoutMs = Math.max(1_000, Math.min(30_000, Number(process.env.RELEASE_REQUEST_TIMEOUT_MS || 10_000)));

if (!baseUrl) {
  throw new Error('release_url_required: pass a URL or set AQARAT_RELEASE_URL');
}

async function request(path, options = {}) {
  const response = await timedFetch(`${baseUrl}${path}`, { redirect: 'manual', ...options }, requestTimeoutMs);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

const health = await request('/healthz');
if (health.status !== 200 || health.body?.ok !== true) throw new Error(`health_failed:${health.status}`);
const requiredSecurityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};
for (const [name, expected] of Object.entries(requiredSecurityHeaders)) {
  if (health.headers[name] !== expected) throw new Error(`security_header_failed:${name}`);
}
if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(String(health.headers['x-correlation-id'] || ''))) {
  throw new Error('correlation_id_header_failed');
}
if ('telegram_token_configured' in (health.body || {}) || 'intake_secret_configured' in (health.body || {})) {
  throw new Error('health_discloses_secret_configuration');
}
if (expectedSha && health.body?.release !== expectedSha) {
  throw new Error(`release_sha_mismatch:expected=${expectedSha}:actual=${health.body?.release || 'missing'}`);
}

const telegram = await request('/api/telegram/status');
if (telegram.status !== 401) throw new Error(`telegram_status_not_protected:${telegram.status}`);

const intake = await request('/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
if (intake.status !== 401) throw new Error(`intake_not_protected:${intake.status}`);

const publicConfig = await request('/api/public-config');
if (publicConfig.status !== 200 || !publicConfig.body || 'supabase_url' in publicConfig.body || 'api_key' in publicConfig.body) {
  throw new Error(`public_config_contract_failed:${publicConfig.status}`);
}

console.log(JSON.stringify({
  ok: true,
  url: baseUrl,
  release: health.body?.release || null,
  smoke_checks: {
    health: health.status,
    telegram_unauthorized: telegram.status,
    intake_unauthorized: intake.status,
    public_config: publicConfig.status,
  },
}));
