import { scorePropertyMatch, chooseCanonical } from '../intelligence/entity-resolver.mjs';
import { scoreLead } from '../intelligence/lead-scorer.mjs';
import { buildContentBrief } from '../content/content-planner.mjs';
import { reviewContent } from '../review/policy.mjs';
import { buildPublicationJob } from '../publishing/policy.mjs';

export function resolveCandidates(candidates = []) {
  const groups = [];
  for (const candidate of candidates) {
    let attached = false;
    for (const group of groups) {
      const match = scorePropertyMatch(candidate, group[0]);
      if (match.score >= 0.85) {
        group.push(candidate);
        attached = true;
        break;
      }
    }
    if (!attached) groups.push([candidate]);
  }

  return groups.map((group) => ({
    canonical: chooseCanonical(group),
    members: group,
    match_count: group.length,
  }));
}

export function buildLead(signal = {}) {
  return scoreLead(signal);
}

export function prepareContent(entity, channel = 'telegram') {
  return buildContentBrief(entity, channel);
}

export function gateContent({ body, confidence, provenanceCount, channel }) {
  return reviewContent({ body, confidence, provenanceCount, channel });
}

export function planPublication({ contentVariantId, channel, destination, review }) {
  return buildPublicationJob({
    contentVariantId,
    channel,
    destination,
    approved: review?.approved === true,
  });
}

export function buildPipelineDecision({ entity, leadSignal, content, channel = 'telegram' }) {
  const lead = buildLead(leadSignal);
  const review = gateContent({
    body: content,
    confidence: entity?.confidence,
    provenanceCount: entity?.provenance_count,
    channel,
  });
  const publication = planPublication({
    contentVariantId: entity?.content_variant_id,
    channel,
    destination: entity?.destination,
    review,
  });

  return {
    lead,
    content_brief: prepareContent(entity, channel),
    review,
    publication,
    ready_for_publication: publication.status === 'queued',
  };
}
