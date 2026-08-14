import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCandidates, buildPipelineDecision } from './orchestrator.mjs';

test('resolver groups duplicate property candidates and chooses highest-confidence canonical', () => {
  const groups = resolveCandidates([
    { id: 'a', name: 'شقة السادات', phone: '01012345678', address: 'المنطقة السابعة مدينة السادات', city: 'مدينة السادات', confidence: 0.72, source_url: 'https://one.example/a' },
    { id: 'b', name: 'شقة السادات', phone: '+201012345678', address: 'المنطقة السابعة مدينة السادات', city: 'مدينة السادات', confidence: 0.91, source_url: 'https://two.example/b' },
    { id: 'c', name: 'فيلا مختلفة', phone: '01199999999', address: 'حي آخر', city: 'مدينة السادات', confidence: 0.8, source_url: 'https://three.example/c' },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].canonical.id, 'b');
  assert.equal(groups[0].match_count, 2);
});

test('pipeline blocks external publishing when review requires human approval', () => {
  const result = buildPipelineDecision({
    entity: {
      id: 'p1',
      entity_type: 'property',
      name: 'شقة 120 متر',
      city: 'مدينة السادات',
      confidence: 0.9,
      provenance_count: 2,
      content_variant_id: 'cv1',
    },
    leadSignal: {
      has_contact: true,
      explicit_intent_score: 0.9,
      property_interest_score: 0.8,
      sadat_city_score: 1,
      recency_score: 0.9,
    },
    content: 'شقة 120 متر بمدينة السادات. السعر مثبت بالمصدر.',
    channel: 'facebook',
  });

  assert.equal(result.review.approved, false);
  assert.equal(result.publication.status, 'blocked_review');
  assert.equal(result.publication.requires_human, true);
  assert.equal(result.ready_for_publication, false);
});

test('pipeline can approve owned telegram content with evidence', () => {
  const result = buildPipelineDecision({
    entity: {
      id: 'p2',
      entity_type: 'property',
      name: 'شقة للبيع',
      city: 'مدينة السادات',
      confidence: 0.9,
      provenance_count: 2,
      content_variant_id: 'cv2',
    },
    leadSignal: {
      has_contact: true,
      explicit_intent_score: 0.8,
      property_interest_score: 0.8,
      sadat_city_score: 1,
      recency_score: 1,
    },
    content: 'شقة للبيع في مدينة السادات. تفاصيل موثقة بالمصدر.',
    channel: 'telegram',
  });

  assert.equal(result.review.approved, true);
  assert.equal(result.publication.status, 'queued');
  assert.equal(result.publication.requires_human, false);
  assert.equal(result.ready_for_publication, true);
});
