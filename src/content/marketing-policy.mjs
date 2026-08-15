import { renderSalesFramework, buildPersuasionPlan } from './sales-strategy.mjs';
import { getPublicBrandConfig } from '../config/public-brand.mjs';

const MARKETING_CHANNELS = new Set(['telegram', 'website', 'facebook', 'whatsapp', 'linkedin', 'classified']);
const INTERNAL_KEYS = new Set([
  'owner', 'owner_name', 'seller', 'seller_name', 'office', 'office_name', 'broker', 'broker_name',
  'contact_name', 'phone', 'phones', 'primary_phone', 'email', 'emails', 'sender_id', 'chat_id',
  'source_event_id', 'external_event_id', 'source_url', 'source_record_id', 'raw_text', 'person_id',
  'contact_id', 'property_id', 'lead_id', 'lead_score', 'entity_match_score', 'reviewer_id',
  'price', 'currency', 'asking_price', 'internal_price', 'net_price', 'minimum_price', 'seller_price',
]);

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
  const safeEntity = { ...entity, price: undefined, currency: undefined };
  const persuasion = buildPersuasionPlan(safeEntity, { channel, ...strategyContext });
  const brand = getPublicBrandConfig();

  return {
    channel,
    audience: publicChannel ? 'public' : 'internal',
    brand: brand.brand,
    identity_mode: 'configurable_brand',
    contact: {
      phone: brand.phone || null,
      whatsapp: brand.whatsapp || null,
      website: brand.website || null,
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
      installments_clear: entity?.installments_clear === true ? true : null,
      features: sanitizeAttributes(entity?.features ?? entity?.attributes),
    },
    strategy: persuasion,
    suppressed_fields: [...INTERNAL_KEYS],
    public_contact_policy: 'lara_brand_only',
    public_price_policy: 'never_publish_internal_price',
    public_style: 'sales_marketing_not_data_dump',
  };
}

export function renderSalesCopy(entity, channel = 'telegram', strategyContext = {}) {
  const ctx = buildPublicMarketingContext(entity, channel, strategyContext);
  const sales = renderSalesFramework(ctx.property, { channel, ...strategyContext });
  const brand = getPublicBrandConfig();
  const contact = brand.phone || brand.whatsapp || brand.website || brand.brand;
  const suffix = contact !== brand.brand ? ` — ${contact}` : '';
  return sales.body.replace(/لارا للتسويق العقاري\.?$/u, `${brand.brand}${suffix}.`).replace(/لارا للتسويق العقاري/gu, brand.brand);
}

export function assertPublicCopySafe(copy, entity, channel, options = {}) {
  const {
    checkPrice = true,
    allowConfiguredContact = true,
  } = options;
  const text = String(copy ?? '');
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const forbiddenValues = [];
  const brand = getPublicBrandConfig();
  const publicDigits = [brand.phone, brand.whatsapp].filter(Boolean).map((v) => String(v).replace(/\D/g, '')).filter((v) => v.length >= 8);
  const candidates = [
    entity?.phone, entity?.primary_phone, entity?.phones, entity?.contact_name, entity?.owner_name,
    entity?.seller_name, entity?.office_name, entity?.broker_name, entity?.email, entity?.source_url,
    entity?.source_event_id, entity?.source_record_id, entity?.raw_text, entity?.sender_id, entity?.chat_id,
    entity?.person_id, entity?.contact_id, entity?.property_id, entity?.lead_id,
    entity?.price, entity?.asking_price, entity?.internal_price, entity?.net_price, entity?.minimum_price,
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).map(String);

  for (const value of candidates) {
    const digits = value.replace(/\D/g, '');
    const isConfiguredContact = allowConfiguredContact && digits.length >= 8 && publicDigits.some((publicNumber) => digits === publicNumber);
    if (isConfiguredContact) continue;
    if (digits.length >= 8 && normalizedText.replace(/\D/g, '').includes(digits)) forbiddenValues.push(value);
    if (value.length >= 4 && normalizedText.includes(value)) forbiddenValues.push(value);
  }

  if (!checkPrice) {
    for (const value of [entity?.price, entity?.asking_price, entity?.internal_price, entity?.net_price, entity?.minimum_price].filter((v) => v != null).map(String)) {
      const index = forbiddenValues.indexOf(value);
      if (index >= 0) forbiddenValues.splice(index, 1);
    }
  }

  const phoneLike = normalizedText.match(/(?:\+?20|0)?1[0125]\d{8}/g) ?? [];
  for (const number of phoneLike) {
    const digits = number.replace(/\D/g, '');
    if (!allowConfiguredContact || !publicDigits.some((publicNumber) => digits.includes(publicNumber) || publicNumber.includes(digits))) {
      forbiddenValues.push(number);
    }
  }

  const hasBrand = normalizedText.includes(brand.brand);
  const publicChannel = MARKETING_CHANNELS.has(String(channel).toLowerCase());
  const ok = forbiddenValues.length === 0 && normalizedText.length > 0 && (!publicChannel || hasBrand);
  return {
    ok,
    forbidden_values: [...new Set(forbiddenValues)],
    channel,
    audience: publicChannel ? 'public' : 'internal',
    policy: 'lara_brand_only',
    identity_mode: 'configurable_brand',
    public_price_policy: 'never_publish_internal_price',
    has_brand: hasBrand,
    phone_leak_scan: true,
  };
}
