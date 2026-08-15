const MARKETING_CHANNELS = new Set(['telegram', 'website', 'facebook', 'whatsapp', 'linkedin', 'classified']);
const INTERNAL_KEYS = new Set([
  'owner', 'owner_name', 'seller', 'seller_name', 'office', 'office_name', 'broker', 'broker_name',
  'contact_name', 'phone', 'phones', 'primary_phone', 'email', 'emails', 'sender_id', 'chat_id',
  'source_event_id', 'external_event_id', 'source_url', 'raw_text', 'person_id', 'contact_id', 'property_id',
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
      out[key] = sanitizeAttributes(raw);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

export function buildPublicMarketingContext(entity, channel = 'telegram') {
  const publicChannel = MARKETING_CHANNELS.has(channel);
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
      features: sanitizeAttributes(entity?.features ?? entity?.attributes),
    },
    suppressed_fields: [...INTERNAL_KEYS],
    public_contact_policy: 'larabrand_only',
    public_style: 'sales_marketing_not_data_dump',
  };
}

export function renderSalesCopy(entity, channel = 'telegram') {
  const ctx = buildPublicMarketingContext(entity, channel);
  const parts = [];
  const type = ctx.property.property_type === 'land' ? 'قطعة أرض' : 'عقار';
  parts.push(`فرصة ${type} مميزة في ${ctx.property.city ?? 'مدينة السادات'}`);
  if (ctx.property.district) parts.push(`📍 ${ctx.property.district}`);
  if (ctx.property.area_m2 != null) parts.push(`📐 ${ctx.property.area_m2} م²`);
  if (ctx.property.bedrooms != null || ctx.property.bathrooms != null) {
    const rooms = ctx.property.bedrooms != null ? `${ctx.property.bedrooms} غرف` : '';
    const baths = ctx.property.bathrooms != null ? `${ctx.property.bathrooms} حمام` : '';
    parts.push(`🏠 ${[rooms, baths].filter(Boolean).join(' • ')}`);
  }
  if (ctx.property.price != null) parts.push(`💰 ${new Intl.NumberFormat('ar-EG').format(ctx.property.price)} ${ctx.property.currency}`);
  parts.push('للتفاصيل والحجز والتواصل:');
  parts.push(`📞 ${ctx.contact.phone || ctx.contact.whatsapp || ctx.contact.website || 'تواصل مع لارا للتسويق العقاري'}`);
  return parts.join('\n');
}

export function assertPublicCopySafe(copy, entity, channel) {
  const text = String(copy ?? '');
  const forbiddenValues = [];
  const candidates = [
    entity?.phone, entity?.primary_phone, entity?.contact_name, entity?.owner_name, entity?.office_name,
  ].filter(Boolean).map(String);
  for (const value of candidates) {
    const normalized = value.replace(/\D/g, '');
    if (normalized && normalized.length >= 8 && text.replace(/\D/g, '').includes(normalized)) forbiddenValues.push(value);
    if (value.length >= 4 && text.includes(value)) forbiddenValues.push(value);
  }
  const ok = forbiddenValues.length === 0 && text.length > 0;
  return { ok, forbidden_values: [...new Set(forbiddenValues)], channel, audience: 'public' };
}
