import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDeepHealth } from '../src/runtime/deep-health.mjs';

function mockResponse({ status = 200, body = {}, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

test('deep health returns healthy matrix when all dependencies respond', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  const geminiRequests = [];
  globalThis.fetch = async (url, options) => {
    seen.push(String(url));
    if (String(url).includes('/rest/v1/properties')) return mockResponse({ body: [] });
    if (String(url).includes('/rest/v1/jobs')) return mockResponse({ body: [] });
    if (String(url).includes('api.telegram.org')) {
      if (String(url).endsWith('/getMe')) return mockResponse({ body: { ok: true, result: { id: 1 } } });
      return mockResponse({ body: { ok: true, result: { url: 'https://aqarat-eg.vercel.app/api/telegram/update', pending_update_count: 0 } } });
    }
    if (String(url).includes(':generateContent')) {
      geminiRequests.push(JSON.parse(options.body));
      return mockResponse({ body: { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] } });
    }
    throw new Error(`unexpected_url:${url}`);
  };

  try {
    const result = await collectDeepHealth({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      PUBLIC_BASE_URL: 'https://aqarat-eg.vercel.app',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-3.6-flash',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
      VERCEL_GIT_COMMIT_SHA: 'test-sha',
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'ok');
    assert.equal(result.release, 'test-sha');
    assert.equal(result.components.supabase.status, 'ok');
    assert.equal(result.components.telegram.status, 'ok');
    assert.equal(result.components.gemini.status, 'ok');
    assert.equal(result.components.google_sheets.status, 'ok');
    assert.ok(seen.some((url) => url.includes('/rest/v1/properties')));
    assert.equal(geminiRequests[0].generationConfig.maxOutputTokens, 256);
    assert.equal(geminiRequests[0].generationConfig.responseSchema.required[0], 'ok');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deep health marks a malformed Gemini response as degraded', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes(':generateContent')) return mockResponse({ body: { candidates: [{ content: { parts: [{ text: 'OK' }] } }] } });
    throw new Error(`unexpected_url:${url}`);
  };

  try {
    const result = await collectDeepHealth({
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-3.6-flash',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    });
    assert.equal(result.ok, false);
    assert.equal(result.components.gemini.status, 'degraded');
    assert.equal(result.components.gemini.error, 'unexpected_response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deep health preserves Gemini 429 and exposes a bounded Retry-After hint', async () => {
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes(':generateContent')) {
      geminiCalls += 1;
      return mockResponse({ status: 429, headers: { 'retry-after': '120' }, body: { error: { status: 'RESOURCE_EXHAUSTED' } } });
    }
    throw new Error(`unexpected_url:${url}`);
  };

  try {
    const result = await collectDeepHealth({
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_MODEL: 'gemini-3.6-flash',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
    });
    assert.equal(result.ok, false);
    assert.equal(result.components.gemini.status, 'error');
    assert.equal(result.components.gemini.code, 429);
    assert.equal(result.components.gemini.retry_after_seconds, 120);
    assert.equal(geminiCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deep health does not fail when an optional integration is unconfigured', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/rest/v1/properties')) return mockResponse({ body: [] });
    if (String(url).includes('/rest/v1/jobs')) return mockResponse({ body: [] });
    throw new Error(`unexpected_url:${url}`);
  };

  try {
    const result = await collectDeepHealth({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      VERCEL_GIT_COMMIT_SHA: 'test-sha',
    });
    assert.equal(result.ok, true);
    assert.equal(result.components.telegram.status, 'not_configured');
    assert.equal(result.components.gemini.status, 'not_configured');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
