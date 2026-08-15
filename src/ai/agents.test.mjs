import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterestAIInput } from './agents.mjs';

test('interest agent input uses the shared multilingual PII boundary', () => {
  const safe = buildInterestAIInput({
    text: 'اتصل بي على ٠١٠٠٠٩٢٥٤٥١ أو interest@example.com',
    property: { city: 'مدينة السادات', phone: '+201000925451', owner_name: 'Private Owner' },
    context: { email: 'context@example.com', budget: 7100000 },
  });

  const serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, /٠١٠٠٠٩٢٥٤٥١|201000925451|interest@example\.com|context@example\.com|Private Owner/);
  assert.match(serialized, /PHONE_REDACTED/);
  assert.match(serialized, /EMAIL_REDACTED/);
  assert.equal(safe.property.city, 'مدينة السادات');
  assert.equal(safe.context.budget, 7100000);
});
