export function classifyInterestSignal({ text = '', property = {}, channel = 'telegram' } = {}) {
  const normalized = String(text).toLowerCase();
  const buyerWords = ['عايز أشتري', 'عايز اشتري', 'مطلوب', 'بدور على', 'للبحث عن', 'محتاج'];
  const sellerWords = ['للبيع', 'مالك', 'عندي أرض', 'عندي شقة', 'عندي عقار'];
  const investorWords = ['استثمار', 'استثمر', 'عائد', 'مربح', 'استثماري'];
  const has = (words) => words.some((w) => normalized.includes(w));

  const intent = has(buyerWords) ? 'buyer' : has(investorWords) ? 'investor' : has(sellerWords) ? 'seller' : 'unknown';
  const score = intent === 'unknown' ? 0 : Math.min(1, 0.6 + (property.city ? 0.15 : 0) + (channel ? 0.1 : 0));

  return {
    intent,
    score,
    evidence: {
      channel,
      matched_terms: (intent === 'buyer' ? buyerWords : intent === 'investor' ? investorWords : sellerWords).filter((w) => normalized.includes(w)),
    },
  };
}

export function buildInterestProfile({ personId, signal, property = {}, observedAt = new Date().toISOString() } = {}) {
  return {
    person_id: personId ?? null,
    interest_type: signal?.intent ?? 'unknown',
    property_type: property.property_type ?? null,
    city: property.city ?? null,
    district: property.district ?? null,
    min_price: null,
    max_price: property.price ?? null,
    min_area_m2: null,
    max_area_m2: property.area_m2 ?? null,
    intent_score: Number(signal?.score ?? 0),
    evidence: signal?.evidence ?? {},
    status: 'active',
    observed_at: observedAt,
  };
}

export function buildInteraction({ personId = null, propertyId = null, channel, interactionType, direction, externalEventId = null, payload = {}, observedAt = new Date().toISOString() } = {}) {
  return {
    person_id: personId,
    property_id: propertyId,
    channel,
    interaction_type: interactionType,
    direction,
    external_event_id: externalEventId,
    payload,
    observed_at: observedAt,
  };
}

export function summarizeMarketSignal({ impressions = 0, views = 0, replies = 0, qualifiedInquiries = 0, conversions = 0 } = {}) {
  const safeViews = Math.max(1, views);
  const safeImpressions = Math.max(1, impressions);
  return {
    view_rate: views / safeImpressions,
    reply_rate: replies / safeViews,
    qualified_rate: qualifiedInquiries / Math.max(1, replies),
    conversion_rate: conversions / Math.max(1, qualifiedInquiries),
  };
}
