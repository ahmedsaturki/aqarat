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
  'dashboard/overview': () => import('../src/api-routes/dashboard/overview.mjs'),
};

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function routeFromRequest(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const explicitRoute = url.searchParams.get('route');
  if (explicitRoute) return explicitRoute.replace(/^\/api\//, '').replace(/\/+$/, '');
  return url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
}

export default async function handler(req, res) {
  const route = routeFromRequest(req);
  const load = HANDLERS[route];
  if (!load) return json(res, 404, { ok: false, error: 'route_not_found' });

  try {
    const module = await load();
    return module.default(req, res);
  } catch (error) {
    console.error(JSON.stringify({ event: 'api_route_error', route, error: error?.message || String(error) }));
    return json(res, 500, { ok: false, error: 'internal_server_error' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
