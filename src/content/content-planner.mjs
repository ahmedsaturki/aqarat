const CHANNEL_RULES = {
  telegram: { maxChars: 3500, tone: 'direct' },
  website: { maxChars: 5000, tone: 'informative' },
  facebook: { maxChars: 3000, tone: 'conversational' },
  linkedin: { maxChars: 3000, tone: 'professional' },
  whatsapp: { maxChars: 2500, tone: 'concise' },
};

export function buildContentBrief(entity, channel = 'telegram') {
  const rules = CHANNEL_RULES[channel] ?? CHANNEL_RULES.telegram;
  return {
    channel,
    locale: 'ar-EG',
    tone: rules.tone,
    max_chars: rules.maxChars,
    must_include: ['verified facts', 'location', 'price when verified', 'contact method when permitted'],
    must_exclude: ['invented facts', 'unverified claims', 'pressure tactics', 'personal data without provenance'],
    entity: {
      type: entity?.entity_type ?? 'property',
      id: entity?.id ?? null,
      name: entity?.name ?? null,
      city: entity?.city ?? null,
      attributes: entity?.attributes ?? {},
      confidence: entity?.confidence ?? 0,
      source_url: entity?.source_url ?? null,
    },
  };
}
