import { handleTelegramUpdate } from '../../../src/runtime/vercel-handler.mjs';

export default async function handler(req, res) {
  // Keep the method gate at the edge of the function so a simple health/probe
  // request cannot trigger Telegram-adapter module loading.
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  return handleTelegramUpdate(req, res);
}
