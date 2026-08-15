import test from 'node:test';
import assert from 'node:assert/strict';

test('telegram service uses the raw webhook secret contract', async () => {
  const previous = {
    secret: process.env.TELEGRAM_WEBHOOK_SECRET,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.TELEGRAM_WEBHOOK_SECRET = 'contract-secret';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const module = await import(`./telegram-service.mjs?contract=${Date.now()}`);
    const payload = {
      update_id: 1,
      message: { text: 'test', from: { id: 1 }, chat: { id: 1 } },
    };

    const denied = await module.processTelegramUpdate(payload, {
      'x-telegram-bot-api-secret-token': 'hashed-or-wrong-secret',
    });
    assert.deepEqual(denied, {
      ok: false,
      status: 401,
      error: 'telegram_webhook_unauthorized',
    });

    await assert.rejects(
      () => module.processTelegramUpdate(payload, {
        'x-telegram-bot-api-secret-token': 'contract-secret',
      }),
      /SUPABASE_URL_required/,
    );
  } finally {
    if (previous.secret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = previous.secret;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.serviceKey;
  }
});
