const DAY_MS = 86_400_000;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function norm(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي');
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function freshnessScore(dateValue, nowMs = Date.now()) {
  if (!dateValue) return 0.15;
  const ts = Date.parse(dateValue);
  if (!Number.isFinite(ts)) return 0.15;
  const ageDays = Math.max(0, (nowMs - ts) / DAY_MS);
  return clamp(Math.exp(-ageDays / 14));
}

function completenessScore(property) {
  const fields = ['city', 'district', 'property_type', 'transaction_type', 'area_m2', 'price', 'bedrooms', 'bathrooms'];
  const present = fields.filter((key) => property?.[key] != null && property?.[key] !== '' && property?.[key] !== 'unknown').length;
  return present / fields.length;
}

export function scorePropertyOpportunity(property, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const confidence = clamp(numeric(property?.confidence) ?? 0);
  const freshness = freshnessScore(property?.last_seen_at ?? property?.updated_at, nowMs);
  const completeness = completenessScore(property);
  const active = norm(property?.status) === 'active' ? 1 : 0;
  const priceKnown = numeric(property?.price) != null ? 1 : 0;

  const opportunity = clamp(
    confidence * 0.30 +
    freshness * 0.30 +
    completeness * 0.20 +
    active * 0.15 +
    priceKnown * 0.05,
  );

  const reasons = [];
  if (freshness >= 0.7) reasons.push('fresh_listing');
  else if (freshness < 0.3) reasons.push('stale_listing');
  if (confidence >= 0.8) reasons.push('high_confidence');
  if (completeness >= 0.75) reasons.push('well_described');
  if (active) reasons.push('active_status');
  if (priceKnown) reasons.push('price_available');

  return {
    score: Number(opportunity.toFixed(4)),
    freshness: Number(freshness.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    completeness: Number(completeness.toFixed(4)),
    reasons,
  };
}

function rangeScore(value, min, max) {
  const v = numeric(value);
  if (v == null) return 0.5;
  const lo = numeric(min);
  const hi = numeric(max);
  if (lo == null && hi == null) return 0.5;
  if (lo != null && v < lo) {
    const distance = lo === 0 ? 1 : Math.abs(v - lo) / lo;
    return clamp(1 - distance * 2);
  }
  if (hi != null && v > hi) {
    const distance = hi === 0 ? 1 : Math.abs(v - hi) / hi;
    return clamp(1 - distance * 2);
  }
  return 1;
}

export function scorePropertyMatch(property, interest) {
  const signals = [];

  const cityMatch = norm(property?.city) && norm(property?.city) === norm(interest?.city) ? 1 : 0;
  if (cityMatch) signals.push('city_match');

  const districtMatch = interest?.district && norm(property?.district) === norm(interest.district) ? 1 : 0;
  if (districtMatch) signals.push('district_match');

  const typeMatch = interest?.property_type && norm(property?.property_type) === norm(interest.property_type) ? 1 : 0;
  if (typeMatch) signals.push('property_type_match');

  const transactionMatch = interest?.transaction_type && norm(property?.transaction_type) === norm(interest.transaction_type) ? 1 : 0;
  if (transactionMatch) signals.push('transaction_match');

  const priceMatch = rangeScore(property?.price, interest?.min_price, interest?.max_price);
  if (priceMatch === 1) signals.push('price_in_range');

  const areaMatch = rangeScore(property?.area_m2, interest?.min_area_m2, interest?.max_area_m2);
  if (areaMatch === 1) signals.push('area_in_range');

  const intent = clamp(numeric(interest?.intent_score) ?? 0.5);
  const score = clamp(
    cityMatch * 0.25 +
    districtMatch * 0.15 +
    typeMatch * 0.15 +
    transactionMatch * 0.15 +
    priceMatch * 0.15 +
    areaMatch * 0.05 +
    intent * 0.10,
  );

  return {
    score: Number(score.toFixed(4)),
    intent_score: Number(intent.toFixed(4)),
    signals,
    qualified: score >= 0.72,
  };
}

export function rankPropertyOpportunities(properties, options = {}) {
  return [...(properties ?? [])]
    .map((property) => ({
      property_id: property?.id ?? null,
      property,
      intelligence: scorePropertyOpportunity(property, options),
    }))
    .sort((a, b) => b.intelligence.score - a.intelligence.score);
}

export function rankPropertyMatches(property, interests) {
  return [...(interests ?? [])]
    .map((interest) => ({
      interest_id: interest?.id ?? null,
      interest,
      match: scorePropertyMatch(property, interest),
    }))
    .sort((a, b) => b.match.score - a.match.score);
}
