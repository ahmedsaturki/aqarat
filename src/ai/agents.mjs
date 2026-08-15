import { AI_AGENT_ROLES, runStructuredAgent } from './agent-runtime.mjs';

const PROPERTY_SCHEMA = {
  type: 'object',
  properties: {
    is_listing: { type: 'boolean', description: 'True only when the evidence describes one or more actual property listings, not a generic category/index page.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: ['string', 'null'] },
          property_type: { type: ['string', 'null'] },
          transaction_type: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          district: { type: ['string', 'null'] },
          area_m2: { type: ['number', 'null'] },
          price: { type: ['number', 'null'] },
          currency: { type: ['string', 'null'] },
          parcel_number: { type: ['integer', 'null'] },
          bedrooms: { type: ['integer', 'null'] },
          bathrooms: { type: ['integer', 'null'] },
          features: { type: 'array', items: { type: 'string' } },
          evidence_spans: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'property_type', 'transaction_type', 'city', 'district', 'area_m2', 'price', 'currency', 'parcel_number', 'bedrooms', 'bathrooms', 'features', 'evidence_spans'],
      },
    },
  },
  required: ['is_listing', 'confidence', 'candidates'],
};

const INTEREST_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['buyer', 'seller', 'investor', 'tenant', 'landlord', 'broker', 'unknown'] },
    score: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: 'array', items: { type: 'string' } },
    next_action: { type: 'string', enum: ['qualify', 'match_property', 'follow_up', 'classify_only'] },
  },
  required: ['intent', 'score', 'evidence', 'next_action'],
};

const MARKETING_SCHEMA = {
  type: 'object',
  properties: {
    audience: { type: 'string', enum: ['buyer', 'investor', 'general_market', 'seller'] },
    funnel_stage: { type: 'string', enum: ['attention', 'consideration', 'evaluation', 'action', 'retention'] },
    angle: { type: 'string', enum: ['location', 'value', 'investment', 'use_case', 'clarity', 'scarcity'] },
    hook: { type: 'string' },
    value_proposition: { type: 'string' },
    objections: { type: 'array', items: { type: 'string' } },
    proof_points: { type: 'array', items: { type: 'string' } },
    cta: { type: 'string' },
  },
  required: ['audience', 'funnel_stage', 'angle', 'hook', 'value_proposition', 'objections', 'proof_points', 'cta'],
};

export async function runPropertyExtractionAgent(evidence) {
  return runStructuredAgent({
    agent: AI_AGENT_ROLES.PROPERTY_EXTRACTION,
    system: 'You are the Aqarat property extraction agent. Use only the supplied evidence. Never invent missing values. Reject generic category/index pages as not a listing. Return structured JSON only. Any extracted value must have supporting evidence_spans.',
    input: {
      title: evidence?.extracted_payload?.title || null,
      description: evidence?.extracted_payload?.description || null,
      text: evidence?.extracted_payload?.text || null,
      json_ld: evidence?.extracted_payload?.json_ld || [],
      canonical_url: evidence?.canonical_url || evidence?.source_url || null,
    },
    schema: PROPERTY_SCHEMA,
  });
}

export async function runInterestIntelligenceAgent({ text, property = {}, context = {} } = {}) {
  return runStructuredAgent({
    agent: AI_AGENT_ROLES.INTEREST_INTELLIGENCE,
    system: 'You are the Aqarat interest-intelligence agent. Infer intent only from explicit or strongly evidenced language. Never infer buyer intent merely from possessing a contact or being related to a listing.',
    input: { text, property, context },
    schema: INTEREST_SCHEMA,
  });
}

export async function runSalesMarketingAgent({ property = {}, audience = 'general_market', funnelStage = 'attention', channel = 'telegram' } = {}) {
  return runStructuredAgent({
    agent: AI_AGENT_ROLES.SALES_MARKETING,
    system: 'You are the Aqarat sales-marketing strategist. Build ethical persuasion plans from verified facts only. Never expose seller/owner/broker/source/private contact data. Public CTA identity is Lara Real Estate only. Never invent scarcity, guarantees, social proof, price advantages, ROI, or urgency.',
    input: { property, audience, funnel_stage: funnelStage, channel },
    schema: MARKETING_SCHEMA,
  });
}

export async function runDiscoveryTriageAgent(evidence) {
  return runStructuredAgent({
    agent: AI_AGENT_ROLES.DISCOVERY_TRIAGE,
    system: 'You are the Aqarat discovery triage agent. Decide whether the page represents real individual property listings or only an index, category, company, generic city page, or unrelated page. When listings exist, return candidate facts only when explicitly supported by the evidence.',
    input: {
      title: evidence?.extracted_payload?.title || null,
      description: evidence?.extracted_payload?.description || null,
      text: evidence?.extracted_payload?.text || null,
      canonical_url: evidence?.canonical_url || evidence?.source_url || null,
    },
    schema: PROPERTY_SCHEMA,
  });
}
