const FUNNEL_STAGES = ['attention', 'consideration', 'evaluation', 'action', 'retention'];

const AUDIENCES = {
  seller: { label: 'مالك / بائع', goals: ['qualified_inquiries', 'confidence_in_lara', 'valuation_conversation'] },
  buyer: { label: 'مشتري', goals: ['clarity', 'comparison', 'next_step'] },
  investor: { label: 'مستثمر', goals: ['opportunity_comparison', 'risk_reduction', 'due_diligence'] },
  general: { label: 'جمهور عقاري', goals: ['awareness', 'local_expertise', 'inquiry'] },
};

const PRINCIPLES = [
  'sell the outcome and fit, not a field dump',
  'use verified proof before persuasion',
  'reduce uncertainty rather than create fear',
  'make the next step easy and specific',
  'protect private source and seller data',
  'adapt message to channel and funnel stage',
  'prefer useful local expertise over commodity reposting',
];

const ANGLE_SIGNALS = [
  ['location', e => Boolean(e?.district || e?.neighborhood || e?.city)],
  ['investment', e => String(e?.property_type || '').toLowerCase() === 'land' && e?.price != null && e?.area_m2 != null],
  ['value', e => e?.price != null && e?.area_m2 != null],
  ['certainty', e => e?.confidence >= 0.8 && e?.provenance_count > 0],
  ['readiness', e => e?.installments_clear === true],
];

export function chooseAudience(signal = {}) {
  const intent = String(signal.intent || '').toLowerCase();
  if (intent === 'seller') return 'seller';
  if (intent === 'buyer') return 'buyer';
  if (intent === 'investor') return 'investor';
  return 'general';
}

export function chooseFunnelStage(signal = {}) {
  const engagement = Number(signal.engagement_score || 0);
  const intent = Number(signal.explicit_intent_score || 0);
  if (intent >= 0.8) return 'action';
  if (engagement >= 0.7) return 'evaluation';
  if (engagement >= 0.35) return 'consideration';
  return 'attention';
}

export function chooseAngles(entity = {}, max = 2) {
  return ANGLE_SIGNALS.filter(([, predicate]) => predicate(entity)).map(([key]) => key).slice(0, max);
}

export function buildStrategy(entity = {}, signal = {}, context = {}) {
  const audience = context.audience || chooseAudience(signal);
  const funnel_stage = context.funnel_stage || chooseFunnelStage(signal);
  const angles = context.preferred_angles?.length ? context.preferred_angles : chooseAngles(entity);
  const profile = AUDIENCES[audience] ?? AUDIENCES.general;

  return {
    audience,
    audience_label: profile.label,
    audience_goals: profile.goals,
    funnel_stage,
    angles: angles.length ? angles : ['certainty'],
    objectives: [
      'grow Aqarat local market intelligence',
      'protect internal data while marketing through Lara',
      'generate qualified conversations rather than raw impressions',
      'improve response and conversion through measured iteration',
    ],
    principles: PRINCIPLES,
    persuasion_tactics: [
      'specific benefit framing',
      'proof-led claims',
      'comparison invitation',
      'objection pre-emption',
      'frictionless CTA',
      'local expertise cues',
    ],
    prohibited_tactics: [
      'fake scarcity',
      'fake social proof',
      'fabricated urgency',
      'guaranteed outcomes without evidence',
      'deceptive bait-and-switch',
      'exposing private seller or source data',
      'no private seller/office contact details',
      'discriminatory targeting',
    ],
  };
}

export { FUNNEL_STAGES, AUDIENCES, PRINCIPLES };
