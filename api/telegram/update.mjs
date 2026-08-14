export default async function handler(req, res) {
  // Method gate first. This also makes the endpoint safe to probe without
  // loading the Telegram adapter and its dependency graph.
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  const { handleTelegramUpdate } = await import('../../src/runtime/vercel-handler.mjs');
  return handleTelegramUpdate(req, res);
}
