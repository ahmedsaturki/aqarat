const CHANNEL_LIMITS = {
  telegram: 3500,
  website: 5000,
  facebook: 3000,
  whatsapp: 2500,
  linkedin: 3000,
};

function text(value) {
  return value == null ? '' : String(value).trim();
}

function formatPrice(price, currency = 'EGP') {
  if (price == null || price === '') return null;
  const number = Number(price);
  if (!Number.isFinite(number)) return null;
  return `${new Intl.NumberFormat('ar-EG').format(number)} ${currency === 'EGP' ? 'جنيه' : currency}`;
}

export function buildFactualDraft(property = {}, context = {}) {
  const channel = String(context.channel || 'telegram').toLowerCase();
  const parts = [];
  const location = [text(property.city), text(property.district), text(property.neighborhood)].filter(Boolean).join(' — ');
  const type = text(property.property_type);
  const transaction = text(property.transaction_type);

  if (type && transaction) parts.push(`${type} ${transaction}`);
  if (location) parts.push(`📍 ${location}`);
  if (property.parcel_number != null) parts.push(`رقم القطعة: ${property.parcel_number}`);
  if (property.area_m2 != null) parts.push(`المساحة: ${property.area_m2} م²`);
  if (property.installments_clear === true) parts.push('الأقساط: خالصة');
  const formattedPrice = formatPrice(property.price, property.currency);
  if (formattedPrice) parts.push(`السعر: ${formattedPrice}`);
  if (property.bedrooms != null) parts.push(`الغرف: ${property.bedrooms}`);
  if (property.bathrooms != null) parts.push(`الحمامات: ${property.bathrooms}`);
  if (property.floor) parts.push(`الدور: ${text(property.floor)}`);
  if (property.finishing) parts.push(`التشطيب: ${text(property.finishing)}`);

  const contact = context.primary_phone ? `للتواصل: ${text(context.primary_phone)}` : '';
  if (contact) parts.push(contact);

  const intro = channel === 'linkedin' ? 'بيانات عقار متاحة بمدينة السادات:' : 'للبيع في مدينة السادات:';
  let body = `${intro}\n\n${parts.join('\n')}`;
  const source = text(context.source_url);
  if (source) body += `\n\nالمصدر: ${source}`;

  const maxChars = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.telegram;
  if (body.length > maxChars) body = body.slice(0, maxChars - 1).trimEnd() + '…';

  const usedFields = ['city','district','neighborhood','property_type','transaction_type','parcel_number','area_m2','installments_clear','price','currency','bedrooms','bathrooms','floor','finishing'];
  const claims = usedFields.filter((key) => property[key] != null && property[key] !== '').map((field) => ({ field, value: property[field] }));

  return {
    body,
    channel,
    locale: 'ar-EG',
    max_chars: maxChars,
    claims,
    provenance: source ? [{ type: 'url', url: source }] : [],
    generated_by: 'aqarat-factual-draft-v1',
  };
}
