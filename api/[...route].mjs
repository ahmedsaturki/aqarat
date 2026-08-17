import { randomUUID } from 'node:crypto';
import { installResponseTelemetry, logStructuredError, safeErrorMessage } from '../src/runtime/observability.mjs';

const HANDLERS = {
  'healthz': () => import('../src/api-routes/healthz.mjs'),
  'healthz/deep': () => import('../src/api-routes/healthz/deep.mjs'),
  'intake': () => import('../src/api-routes/intake.mjs'),
  'jobs/sheets': () => import('../src/api-routes/jobs/sheets.mjs'),
  'public-config': () => import('../src/api-routes/public-config.mjs'),
  'telegram/status': () => import('../src/api-routes/telegram/status.mjs'),
  'telegram/update': () => import('../src/api-routes/telegram/update.mjs'),
  'dashboard/action': () => import('../src/api-routes/dashboard/action.mjs'),
  'dashboard/data': () => import('../src/api-routes/dashboard/data.mjs'),
  'dashboard/discovery-submit': () => import('../src/api-routes/dashboard/discovery-submit.mjs'),
  'dashboard/intelligence': () => import('../src/api-routes/dashboard/intelligence.mjs'),
  'dashboard/login': () => import('../src/api-routes/dashboard/login.mjs'),
  'dashboard/logout': () => import('../src/api-routes/dashboard/logout.mjs'),
  'dashboard/overview': () => import('../src/api-routes/dashboard/overview.mjs'),
};

function correlationIdFromRequest(req) {
  const candidate = req?.headers?.['x-correlation-id'];
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(String(candidate || ''))
    ? String(candidate)
    : randomUUID();
}

function applySecurityHeaders(res, correlationId) {
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (process.env.VERCEL_ENV === 'production') {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
}

function json(res, status, payload, correlationId) {
  const body = JSON.stringify({ ...payload, correlation_id: correlationId });
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', String(Buffer.byteLength(body)));
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

const REWRITE_ROUTE_BY_SOURCE = {
  '/healthz': 'healthz',
  '/intake': 'intake',
  '/telegram/update': 'telegram/update',
  '/api/healthz/deep': 'healthz/deep',
  '/api/jobs/sheets': 'jobs/sheets',
  '/api/telegram/status': 'telegram/status',
  '/api/telegram/update': 'telegram/update',
  '/api/dashboard/action': 'dashboard/action',
  '/api/dashboard/data': 'dashboard/data',
  '/api/dashboard/discovery-submit': 'dashboard/discovery-submit',
  '/api/dashboard/intelligence': 'dashboard/intelligence',
  '/api/dashboard/login': 'dashboard/login',
  '/api/dashboard/logout': 'dashboard/logout',
  '/api/dashboard/overview': 'dashboard/overview',
};

function normalizeRoute(value) {
  return String(value || '').replace(/^\/api\//, '').replace(/\/+$/, '');
}

function routeFromRequest(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const explicitRoute = normalizeRoute(url.searchParams.get('route'));
  // Vercel rewrites may preserve the public source pathname while adding
  // route=...; accept only the exact source-to-handler mapping. A real API
  // pathname can never be redirected to an unrelated handler by query input.
  if (explicitRoute && (
    pathname === '/api/route'
    || REWRITE_ROUTE_BY_SOURCE[pathname] === explicitRoute
  )) return explicitRoute;
  return normalizeRoute(pathname);
}

export default async function handler(req, res) {
  const correlationId = correlationIdFromRequest(req);
  applySecurityHeaders(res, correlationId);
  req.aqaratCorrelationId = correlationId;
  const route = routeFromRequest(req);
  installResponseTelemetry(req, res, { route, correlationId });
  const load = HANDLERS[route];
  if (!load) return json(res, 404, { ok: false, error: 'route_not_found' }, correlationId);

  try {
    const module = await load();
    return module.default(req, res);
  } catch (error) {
    logStructuredError('api_route_error', { route, correlation_id: correlationId, error: safeErrorMessage(error?.message || error) });
    return json(res, 500, { ok: false, error: 'internal_server_error' }, correlationId);
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
