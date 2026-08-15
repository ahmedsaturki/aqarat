import test from 'node:test';
import assert from 'node:assert/strict';
import { aiAvailable, runStructuredAgent } from './agent-runtime.mjs';

test('AI runtime is fail-safe when no provider key is configured', async () => {
  if (aiAvailable()) return;
  const result = await runStructuredAgent({
    agent: 'test-agent',
    system: 'Return a JSON object.',
    input: { value: 1 },
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
    },
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reason, 'GEMINI_API_KEY_not_configured');
});

test('AI runtime rejects non-object schemas before making network calls', async () => {
  await assert.rejects(
    () => runStructuredAgent({ agent: 'bad', system: '', input: {}, schema: { type: 'string' } }),
    /ai_schema_must_be_object/,
  );
});
