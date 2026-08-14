const WEIGHTS = {
  phone: 0.35,
  explicit_intent: 0.25,
  property_interest: 0.2,
  locality: 0.1,
  recency: 0.1,
};

function clamp(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

export function scoreLead(signal = {}) {
  const components = {
    phone: clamp(signal.has_contact ? 1 : 0),
    explicit_intent: clamp(signal.explicit_intent_score),
    property_interest: clamp(signal.property_interest_score),
    locality: clamp(signal.sadat_city_score),
    recency: clamp(signal.recency_score),
  };
  const score = Object.entries(components).reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
  const tier = score >= 0.8 ? 'hot' : score >= 0.55 ? 'warm' : score >= 0.3 ? 'cool' : 'cold';
  return { score: Number(score.toFixed(4)), tier, components, reasons: Object.entries(components).filter(([,v]) => v >= 0.5).map(([k]) => k) };
}
