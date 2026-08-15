import { scorePropertyMatch, chooseCanonical } from '../intelligence/entity-resolver.mjs';
import { scoreLead } from '../intelligence/lead-scorer.mjs';
import { classifyInterestSignal, buildInterestProfile } from '../intelligence/market-graph.mjs';
import { buildContentBrief } from '../content/content-planner.mjs';
import { buildFactualDraft } from '../content/factual-draft.mjs';
import { buildPersuasionPlan } from '../content/sales-strategy.mjs';
import { renderSalesCopy, assertPublicCopySafe } from '../content/marketing-policy.mjs';
import { reviewContent } from '../review/policy.mjs';
import { buildPublicationJob } from '../publishing/policy.mjs';

export function resolveCandidates(candidates = []) {
  const groups = [];
  for (const candidate of candidates) {
    let attached = false;
    for (const group of groups) {
      const match = scorePropertyMatch(candidate, group[0]);
      if (match.score >= 0.85) {
        group.push({ ...candidate, match_score: match.score, match_reasons: match.reasons });
        attached = true;
        break;
      }
    }
    if (!attached) groups.push([{ ...candidate, match_score: 1, match_reasons: ['first_candidate'] }]);
  }

  return groups.map((group) => ({
    canonical: chooseCanonical(group),
    members: group,
    match_count: group.length,
    match_scores: group.map(({ match_score, match_reasons, ...rest }) => ({ id: rest.id ?? null, score: match_score, reasons: match_reasons })),
  }));
}

export function buildLead(signal = {}) {
  return scoreLead(signal);
}

export function classifyInterest(signal = {}) {
  return classifyInterestSignal(signal);
}

export function prepareInterestProfile({ personId, signal, property, observedAt } = {}) {
  return buildInterestProfile({ personId, signal, property, observedAt });
}

export function prepareContent(entity, channel = 'telegram') {
  return buildContentBrief(entity, channel);
}

export function buildFactualContent(entity, context = {}) {
  return buildFactualDraft(entity, context);
}

export function buildMarketingContent(entity, channel = 'telegram', context = {}) {
  const facts = buildFactualContent(entity, { channel, ...context });
  const marketingEntity = { ...entity, ...facts.facts };
  const persuasion = buildPersuasionPlan(marketingEntity, { channel, ...context });
  const body = renderSalesCopy(marketingEntity, channel, context);
  const safety = assertPublicCopySafe(body, entity, channel);
  if (!safety.ok) throw new Error('public_marketing_privacy_violation');

  return {
    ...facts,
    body,
    persuasion,
    public_contact_policy: 'lara_brand_only',
    style: 'sales_marketing',
    psychology_policy: 'ethical_influence',
  };
}

export function gateContent({ body, confidence, provenanceCount, channel, entity }) {
  return reviewContent({ body, confidence, provenanceCount, channel, entity });
}

export function planPublication({ contentVariantId, channel, destination, review }) {
  return buildPublicationJob({
    contentVariantId,
    channel,
    destination,
    approved: review?.approved === true,
  });
}

export function buildPipelineDecision({ entity, leadSignal = {}, interestSignal = null, personId = null, content = null, channel = 'telegram', contentContext = {} }) {
  const lead = buildLead(leadSignal);
  const interest = interestSignal ? classifyInterest({ text: interestSignal.text, property: entity, channel }) : null;
  const interest_profile = interest && personId ? prepareInterestProfile({ personId, signal: interest, property: entity }) : null;

  const marketingContent = buildMarketingContent(entity, channel, {
    ...contentContext,
    upstream_draft_present: content != null && String(content).trim() !== '',
  });

  const safety = assertPublicCopySafe(marketingContent.body, entity, channel);
  if (!safety.ok) throw new Error('public_marketing_privacy_violation');

  const review = gateContent({
    body: marketingContent.body,
    confidence: entity?.confidence,
    provenanceCount: entity?.provenance_count ?? marketingContent.provenance.length,
    channel,
    entity,
  });
  const publication = planPublication({
    contentVariantId: entity?.content_variant_id,
    channel,
    destination: entity?.destination,
    review,
  });

  return {
    lead,
    interest,
    interest_profile,
    content_brief: prepareContent(entity, channel),
    marketing_content: marketingContent,
    review,
    publication,
    ready_for_publication: publication.status === 'queued',
  };
}
