import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePropertyMatch, chooseCanonical } from './entity-resolver.mjs';

test('same phone strongly matches two property candidates', () => {
  const result = scorePropertyMatch(
    { phone: '01012345678', address: 'District 7', city: 'Sadat City', name: 'Apartment 120' },
    { phone: '+201012345678', address: 'District 7', city: 'Sadat City', name: 'Apartment 120' },
  );
  assert.equal(result.score, 1);
  assert.ok(result.reasons.includes('same_phone'));
});

test('canonical candidate is the highest-confidence evidence', () => {
  const result = chooseCanonical([
    { confidence: 0.4, source_url: 'https://b.example' },
    { confidence: 0.91, source_url: 'https://a.example' },
  ]);
  assert.equal(result.source_url, 'https://a.example');
});
