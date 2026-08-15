import { renderSalesFramework, buildPersuasionPlan } from './sales-strategy.mjs';

const MARKETING_CHANNELS = new Set(['telegram', 'website', 'facebook', 'whatsapp', 'linkedin', 'classified']);
const INTERNAL_KEYS = new Set([
  'owner', 'owner_name', 'seller', 'seller_name', 'office', 'office_name', 'broker', 'broker_name',
  'contact_name', 'phone', 'phones', 'primary_phone', 'email', 'emails', 'sender_id', 'chat_id',
  'source_event_id', 'external_event_id', 'source_url', 'source_record_id', 'raw_text', 'person_id',
  'contact_id', 'property_id', 'lead_id', 'lead_score', 'entity_match_score', 'reviewer_id',
]);

const LARA = {
  brand: 'لارا للتسويق العقاري',
  phone: process.env.PUBLIC_MARKETING_PHONE ?? '',
  whatsapp: process.env.PUBLIC_MARKETING_WHATSAPP ?? '',
  website: process.env.PUBLIC_MARKETING_WEBSITE ?? '',
};

function normalizeKey(key) {
  return String(key ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function sanitizeAttributes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(normalizeKey(key))) continue;
    if (typeof raw === 'object' && raw !== null) {
      const nested = sanitizeAttributes(raw);
      if (Object.keys(nested).length) out[key] = nested;
    } else {
      out[key] = raw;
    }
  }
  return out;
}

export function buildPublicMarketingContext(entity, channel = 'telegram', strategyContext = {}) {
  const publicChannel = MARKETING_CHANNELS.has(channel);
  const persuasion = buildPersuasionPlan(entity, { channel, ...strategyContext });

  return {
    channel,
    audience: publicChannel ? 'public' : 'internal',
    brand: LARA.brand,
    contact: {
      phone: LARA.phone || null,
      whatsapp: LARA.whatsapp || null,
      website: LARA.website || null,
    },
    property: {
      city: entity?.city ?? null,
      district: entity?.district ?? null,
      neighborhood: entity?.neighborhood ?? null,
      property_type: entity?.property_type ?? entity?.entity_type ?? null,
      transaction_type: entity?.transaction_type ?? null,
      area_m2: entity?.area_m2 ?? null,
      bedrooms: entity?.bedrooms ?? null,
      bathrooms: entity?.bathrooms ?? null,
      floor: entity?.floor ?? null,
      finishing: entity?.finishing ?? null,
      price: entity?.price ?? null,
      currency: entity?.currency ?? 'EGP',
      installments_clear: entity?.installments_clear === true ? true : null,
      features: sanitizeAttributes(entity?.features ?? entity?.attributes),
    },
    strategy: persuasion,
    suppressed_fields: [...INTERNAL_KEYS],
    public_contact_policy: 'lara_brand_only',
    public_style: 'sales_marketing_not_data_dump',
  };
}

export function renderSalesCopy(entity, channel = 'telegram', strategyContext = {}) {
  const ctx = buildPublicMarketingContext(entity, channel, strategyContext);
  const sales = renderSalesFramework(ctx.property, { channel, ...strategyContext });
  const contact = ctx.contact.phone || ctx.contact.whatsapp || ctx.contact.website || ctx.brand;
  const body = sales.body.replace(/لارا للتسويق العقاري\.?$/u, `لارا للتسويق العقاري${contact !== ctx.brand ? ` — ${contact}` : ''}.`);
  return body;
}

export function assertPublicCopySafe(copy, entity, channel) {
  const text = String(copy ?? '');
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const forbiddenValues = [];
  const candidates = [
    entity?.phone, entity?.primary_phone, entity?.phones, entity?.contact_name, entity?.owner_name,
    entity?.seller_name, entity?.office_name, entity?.broker_name, entity?.email, entity?.source_url,
    entity?.sender_id, entity?.chat_id, entity?.person_id, entity?.contact_id, entity?.property_id,
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).map(String);

  for (const value of candidates) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8 && normalizedText.replace(/\D/g, '').includes(digits)) forbiddenValues.push(value);
    if (value.length >= 4 && normalizedText.includes(value)) forbiddenValues.push(value);
  }

  const laraNumbers = [LARA.phone, LARA.whatsapp].filter(Boolean).map((v) => String(v));
  for (const number of laraNumbers) {
    const digits = number.replace(/\D/g, '');
    if (digits.length >= 8 && !normalizedText.replace(/\D/g, '').includes(digits)) {
      // CTA may intentionally use website/brand text instead of a phone number.
      continue;
    }
  }

  const ok = forbiddenValues.length === 0 && normalizedText.length > 0;
  return {
    ok,
    forbidden_values: [...new Set(forbiddenValues)],
    channel,
    audience: 'public',
    policy: 'lara_brand_only',
  };
}
