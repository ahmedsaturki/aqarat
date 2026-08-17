import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardSessionCookieName,
  expiredDashboardSessionCookie,
  trustedDashboardOrigin,
} from './login.mjs';

function responseMock() {
  const headers = {};
  return { headers, setHeader(name, value) { headers[name] = value; }, status() { return this; }, json(payload) { this.payload = payload; } };
}

test('dashboard login accepts same-origin and non-browser requests', () => {
  const previous = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://aqarat-eg.vercel.app';
  try {
    assert.equal(trustedDashboardOrigin({ headers: { origin: 'https://aqarat-eg.vercel.app', 'sec-fetch-site': 'same-origin' } }), true);
    assert.equal(trustedDashboardOrigin({ headers: {} }), true);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previous;
  }
});

test('dashboard login rejects cross-origin browser requests', () => {
  const previous = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://aqarat-eg.vercel.app';
  try {
    assert.equal(trustedDashboardOrigin({ headers: { origin: 'https://evil.example' } }), false);
    assert.equal(trustedDashboardOrigin({ headers: { 'sec-fetch-site': 'cross-site' } }), false);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previous;
  }
});

test('dashboard login responses are not cacheable and vary by browser origin headers', async () => {
  const previousSecret = process.env.DASHBOARD_ADMIN_SECRET;
  const previousBase = process.env.PUBLIC_BASE_URL;
  process.env.DASHBOARD_ADMIN_SECRET = 'test-secret';
  process.env.PUBLIC_BASE_URL = 'https://aqarat-eg.vercel.app';
  try {
    const { default: handler } = await import(`./login.mjs?cache_headers=${Date.now()}`);
    const res = responseMock();
    await handler({ method: 'POST', headers: { origin: 'https://evil.example' }, body: { password: 'x' } }, res);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers.Pragma, 'no-cache');
    assert.equal(res.headers.Vary, 'Origin, Sec-Fetch-Site');
  } finally {
    if (previousSecret === undefined) delete process.env.DASHBOARD_ADMIN_SECRET;
    else process.env.DASHBOARD_ADMIN_SECRET = previousSecret;
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
  }
});

test('dashboard login rejects oversized passwords before secret comparison', async () => {
  const previousSecret = process.env.DASHBOARD_ADMIN_SECRET;
  const previousBase = process.env.PUBLIC_BASE_URL;
  process.env.DASHBOARD_ADMIN_SECRET = 'test-secret';
  process.env.PUBLIC_BASE_URL = 'https://aqarat-eg.vercel.app';
  try {
    const { default: handler } = await import(`./login.mjs?oversized=${Date.now()}`);
    const res = responseMock();
    await handler({ method: 'POST', headers: { origin: 'https://aqarat-eg.vercel.app' }, body: { password: 'x'.repeat(513) } }, res);
    assert.equal(res.payload.error, 'invalid_credentials');
  } finally {
    if (previousSecret === undefined) delete process.env.DASHBOARD_ADMIN_SECRET;
    else process.env.DASHBOARD_ADMIN_SECRET = previousSecret;
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
  }
});

test('logout cookie expires the existing HttpOnly session without exposing its value', () => {
  const cookieName = dashboardSessionCookieName();
  const cookie = expiredDashboardSessionCookie();
  assert.match(cookie, new RegExp(`^${cookieName}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.doesNotMatch(cookie, /secret|token|password/i);
});
