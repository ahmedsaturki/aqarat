import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardSessionCookieName,
  expiredDashboardSessionCookie,
  trustedDashboardOrigin,
} from './login.mjs';

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
