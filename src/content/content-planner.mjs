import { buildPublicMarketingContext } from './marketing-policy.mjs';

const CHANNEL_RULES = {
  telegram: { maxChars: 3500, tone: 'sales_direct' },
  website: { maxChars: 5000, tone: 'sales_informative' },
  facebook: { maxChars: 3000, tone: 'sales_conversational' },
  linkedin: { maxChars: 3000, tone: 'professional_sales' },
  whatsapp: { maxChars: 2500, tone: 'sales_concise' },
  classified: { maxChars: 3000, tone: 'sales_listing' },
};

export function buildContentBrief(entity, channel = 'telegram') {
  const rules = CHANNEL_RULES[channel] ?? CHANNEL_RULES.telegram;
  const marketing = buildPublicMarketingContext(entity, channel);
  return {
    channel,
    locale: 'ar-EG',
    tone: rules.tone,
    objective: 'sell_or_generate_interest',
    max_chars: rules.maxChars,
    must_include: ['verified public property facts', 'persuasive value proposition', 'location', 'price when verified', 'Lara marketing contact only'],
    must_exclude: [
      'owner identity', 'seller identity', 'broker identity', 'office identity', 'seller phone',
      'seller WhatsApp', 'seller email', 'raw source data', 'source event IDs', 'private contact data',
      'invented facts', 'unverified claims', 'pressure tactics',
    ],
    marketing,
  };
}
