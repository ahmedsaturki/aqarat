const CITY_ALIASES = ['مدينة السادات', 'السادات', 'سادات', 'sadat city', 'el sadat', 'el-sadat', 'alsadat'];
const DISTRICT_ALIASES = {
  'المنطقة الأولى': ['المنطقة الأولى', 'المنطقه الاولى', 'الأولى', 'الاولي', '1st district'],
  'المنطقة الثانية': ['المنطقة الثانية', 'المنطقه الثانيه', 'الثانية', 'الثانيه', '2nd district'],
  'المنطقة الثالثة': ['المنطقة الثالثة', 'المنطقه الثالثه', 'الثالثة', 'الثالثه', '3rd district'],
  'المنطقة الرابعة': ['المنطقة الرابعة', 'المنطقه الرابعه', 'الرابعة', 'الرابعه', '4th district'],
  'المنطقة الخامسة': ['المنطقة الخامسة', 'المنطقه الخامسه', 'الخامسة', 'الخامسه', '5th district'],
  'المنطقة السادسة': ['المنطقة السادسة', 'المنطقه السادسه', 'السادسة', 'السادسه', '6th district'],
  'المنطقة السابعة': ['المنطقة السابعة', 'المنطقه السابعه', 'السابعة', 'السابعه', '7th district'],
  'المنطقة الثامنة': ['المنطقة الثامنة', 'المنطقه الثامنه', 'الثامنة', 'الثامنه', '8th district'],
};

export const MAX_INTAKE_TEXT_LENGTH = 4000;
const MAX_REALISTIC_AREA_M2 = 1_000_000;
const MAX_REALISTIC_PRICE_EGP = 100_000_000_000;
const MAX_REASONABLE_ROOMS = 100;
const MAX_REASONABLE_PARCEL_NUMBER = 1_000_000_000;

function clean(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function invalidInput(code) {
  const error = new Error(code);
  error.status = 422;
  return error;
}

function normalizedText(value) {
  return clean(value).toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function firstMatch(text, patterns) {
  for (const pattern of (Array.isArray(patterns) ? patterns : [patterns])) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseNumber(value) {
  if (value == null) return null;
  const number = Number(normalizeDigits(value).replace(/[,،\s]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parseArea(text) {
  const normalized = normalizeDigits(text);
  const direct = normalized.match(/(\d+(?:\.\d+)?)\s*(?:متر\s*(?:مربع)?|م²|م2|sqm|m2)/i);
  if (direct) return parseNumber(direct[1]);
  const compact = normalized.match(/(?:مساح(?:ة|ه)|مساحة)\s*(?:=|:|-)?\s*(\d+(?:\.\d+)?)\s*(?:متر|م)/i);
  if (compact) return parseNumber(compact[1]);
  const labeled = normalized.match(/(?:مساح(?:ة|ه)|مساحة)\s*(?:=|:|-)?\s*(\d+(?:\.\d+)?)/i);
  return labeled ? parseNumber(labeled[1]) : null;
}

function parseParcelNumber(text) {
  const normalized = normalizeDigits(text);
  const match = firstMatch(normalized, [
    /(?:رقم\s*)?(?:القطعة|قطعه)\s*(?:رقم\s*)?(\d+)/i,
    /رقم\s*(\d+)\s*(?:مساحة|متر)/i,
  ]);
  return match ? Number(match[1]) : null;
}

function parseInstallmentsClear(text) {
  return /(خالصة\s*الاقساط|خالصه\s*الاقساط|خلصت\s*الاقساط|مسدد(?:ة|ه)\s*الاقساط)/i.test(normalizedText(text)) ? true : null;
}

function parseBedrooms(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(\d+)\s*(?:غرف|غرفة|bedrooms?|beds?)/i,
    /(?:غرف|غرفة)\s*(?:عدد\s*)?(\d+)/i,
  ]);
  return match ? Number(match[1]) : null;
}

function parseBathrooms(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(\d+)\s*(?:حمام|حمامات|bathrooms?|baths?)/i,
    /(?:حمام|حمامات)\s*(?:عدد\s*)?(\d+)/i,
  ]);
  return match ? Number(match[1]) : null;
}

function parseFloor(text) {
  const match = firstMatch(normalizeDigits(text), [/(?:الدور|طابق|floor)\s*([\wء-ي-]+)/i, /(?:floor\s*)(\d+)/i]);
  return match ? clean(match[1]) : null;
}

function parsePrice(text) {
  const normalized = normalizeDigits(text);
  const match = firstMatch(normalized, [
    /(\d[\d,]*(?:\.\d+)?)\s*(مليار|billion)\s*([1-9]\d{0,2})\s*(?:جنيه|ج|egp|pounds?)?/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(مليون|million)\s*([1-9]\d{0,2})\s*(?:جنيه|ج|egp|pounds?)?/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(مليون|مليار|ألف|الف|million|billion|k)/i,
    /(?:للبيع|بيع|مطلوب|مطلوب\s*نهائي|نهائي|السعر|بسعر|price)\s*[:：-]?\s*(\d[\d,]*(?:\.\d+)?)/i,
    /(?:جنيه|ج|egp|pounds?)\s*(\d[\d,]*(?:\.\d+)?)/i,
  ]);
  if (!match) return { price: null, currency: null };
  let amount = parseNumber(match[1]);
  if (amount == null) return { price: null, currency: null };
  const unit = normalizedText(match[2] || '');
  const tail = match[3] ? parseNumber(match[3]) : null;
  if (unit === 'مليون' || unit === 'million') amount *= 1_000_000;
  else if (unit === 'مليار' || unit === 'billion') amount *= 1_000_000_000;
  else if (unit === 'الف' || unit === 'k') amount *= 1_000;
  if (tail != null && (unit === 'مليون' || unit === 'million')) amount += tail * 1_000;
  if (tail != null && (unit === 'مليار' || unit === 'billion')) amount += tail * 1_000_000;
  return { price: amount, currency: 'EGP' };
}

function parseTransactionType(text) {
  const normalized = normalizedText(text);
  const sale = /(للبيع|بيع|مطلوب بيع|sale|for sale)/i.test(normalized);
  const rent = /(للايجار|للتاجير|ايجار|تاجير|rent|for rent)/i.test(normalized);
  if (sale && rent) return 'both';
  if (sale) return 'sale';
  if (rent) return 'rent';
  return 'unknown';
}

function parsePropertyType(text) {
  const normalized = normalizedText(text);
  if (/شقه|apartment|flat/i.test(normalized)) return 'apartment';
  if (/فيلا|villa/i.test(normalized)) return 'villa';
  if (/تاون هاوس|townhouse/i.test(normalized)) return 'townhouse';
  if (/توين هاوس|twin house/i.test(normalized)) return 'twin_house';
  if (/مكتب|اداري|office|administrative/i.test(normalized)) return 'office';
  if (/محل|shop|store|retail/i.test(normalized)) return 'shop';
  if (/ارض|أرض|land/i.test(normalized)) return 'land';
  if (/مخزن|warehouse|storage/i.test(normalized)) return 'warehouse';
  if (/عماره|عمارة|building/i.test(normalized)) return 'building';
  return 'unknown';
}

function parseFinishing(text) {
  const normalized = normalizedText(text);
  const values = [
    ['super_lux', /سوبر لوكس|super\s*lux/i],
    ['lux', /لوكس|lux/i],
    ['good', /تشطيب جيد|جيد/i],
    ['semi_finished', /نصف تشطيب|semi[- ]?finished/i],
    ['unfinished', /على الطوب الاحمر|طوب احمر|unfinished/i],
    ['fully_finished', /تشطيب كامل|fully finished/i],
  ];
  return values.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}

function parseContact(text) {
  const normalized = normalizeDigits(text);
  const phone = normalized.match(/(?:\+?20\s?)?(?:01\d{9}|0?1\d{9}|1\d{9})/);
  if (!phone) return null;
  const digits = phone[0].replace(/\D/g, '');
  const normalizedValue = digits.startsWith('20') ? `+${digits}` : `+20${digits.replace(/^0/, '')}`;
  return { value: phone[0].trim(), normalized_value: normalizedValue };
}

function parseDistrict(text) {
  const normalized = normalizedText(text);
  const numbered = normalized.match(/المنطقه\s*(\d{1,2})/i);
  if (numbered) return `المنطقة ${Number(numbered[1])}`;
  for (const [canonical, aliases] of Object.entries(DISTRICT_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalizedText(alias)))) return canonical;
  }
  return null;
}

function parseCity(text) {
  const normalized = normalizedText(text);
  return CITY_ALIASES.some((alias) => normalized.includes(normalizedText(alias))) ? 'مدينة السادات' : null;
}

function inferTitle(property) {
  const type = property.property_type === 'unknown' ? 'عقار' : property.property_type;
  const action = property.transaction_type === 'rent' ? 'للإيجار' : property.transaction_type === 'sale' ? 'للبيع' : 'عقاري';
  return `${type} ${action} — ${property.city || 'غير محدد'}`;
}

function confidenceFor(property) {
  const checks = [
    Boolean(property.city),
    property.property_type !== 'unknown',
    property.transaction_type !== 'unknown',
    property.area_m2 != null,
    property.price != null,
    property.bedrooms != null,
    property.bathrooms != null,
    Boolean(property.district),
    Boolean(property.parcel_number),
    Boolean(property.contacts?.length),
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100) / 100;
}

export function parseNaturalLanguageProperty(rawText) {
  if (typeof rawText !== 'string') throw invalidInput('raw_text_type_invalid');
  const raw = clean(rawText);
  if (!raw) throw invalidInput('raw_text_required');
  if (raw.length > MAX_INTAKE_TEXT_LENGTH) throw invalidInput('raw_text_too_long');

  const price = parsePrice(raw);
  const contact = parseContact(raw);
  const parsed = {
    property_type: parsePropertyType(raw),
    transaction_type: parseTransactionType(raw),
    status: 'active',
    title: null,
    description: raw,
    city: parseCity(raw),
    district: parseDistrict(raw),
    neighborhood: null,
    address: null,
    latitude: null,
    longitude: null,
    area_m2: parseArea(raw),
    bedrooms: parseBedrooms(raw),
    bathrooms: parseBathrooms(raw),
    floor: parseFloor(raw),
    finishing: parseFinishing(raw),
    price: price.price,
    currency: price.currency || 'EGP',
    features: {},
    confidence: 0,
    contacts: contact ? [contact] : [],
    parcel_number: parseParcelNumber(raw),
    installments_clear: parseInstallmentsClear(raw),
    unknown_fields: [],
  };

  if (parsed.parcel_number != null) parsed.features.parcel_number = parsed.parcel_number;
  if (parsed.installments_clear != null) parsed.features.installments_clear = parsed.installments_clear;
  parsed.title = inferTitle(parsed);
  parsed.confidence = confidenceFor(parsed);

  for (const [key, value] of Object.entries(parsed)) {
    if (['title', 'description', 'currency', 'features', 'contacts', 'unknown_fields', 'confidence', 'status', 'parcel_number', 'installments_clear'].includes(key)) continue;
    if (value == null || value === 'unknown') parsed.unknown_fields.push(key);
  }

  return { parsed, validation: validatePropertyCandidate(parsed) };
}

export function validatePropertyCandidate(candidate) {
  const errors = [];
  const warnings = [];
  const area = candidate.area_m2;
  const price = candidate.price;
  const rooms = [candidate.bedrooms, candidate.bathrooms];

  if (!candidate.city) errors.push('city_required');
  if (candidate.city && normalizedText(candidate.city) !== normalizedText('مدينة السادات')) errors.push('unsupported_city');
  if (price != null && (!Number.isFinite(price) || price <= 0)) errors.push('price_invalid');
  if (area != null && (!Number.isFinite(area) || area <= 0)) errors.push('area_invalid');
  if (candidate.parcel_number != null && (!Number.isInteger(candidate.parcel_number) || candidate.parcel_number <= 0 || candidate.parcel_number > MAX_REASONABLE_PARCEL_NUMBER)) errors.push('parcel_number_invalid');
  for (const roomCount of rooms) {
    if (roomCount != null && (!Number.isInteger(roomCount) || roomCount < 0 || roomCount > MAX_REASONABLE_ROOMS)) errors.push('room_count_invalid');
  }
  if (candidate.description && candidate.description.length > MAX_INTAKE_TEXT_LENGTH) errors.push('raw_text_too_long');
  for (const contact of candidate.contacts || []) {
    if (!/^\+201\d{9}$/.test(String(contact.normalized_value || ''))) errors.push('contact_invalid');
  }

  if (area > MAX_REALISTIC_AREA_M2) warnings.push('area_outlier');
  if (price > MAX_REALISTIC_PRICE_EGP) warnings.push('price_outlier');
  if (candidate.bedrooms > 20 || candidate.bathrooms > 20) warnings.push('room_count_outlier');
  if (!candidate.contacts?.length) warnings.push('no_contact_found');
  if (candidate.property_type === 'unknown') warnings.push('property_type_unknown');
  if (candidate.transaction_type === 'unknown') warnings.push('transaction_type_unknown');
  if (area == null) warnings.push('area_missing');
  if (price == null) warnings.push('price_missing');
  if (candidate.parcel_number == null && candidate.property_type === 'land') warnings.push('parcel_number_missing');

  return { valid: errors.length === 0, errors, warnings };
}

export function buildIntakeEvent({ channel = 'other', externalEventId = null, senderId = null, chatId = null, rawText }) {
  const { parsed, validation } = parseNaturalLanguageProperty(rawText);
  return {
    channel,
    external_event_id: externalEventId,
    sender_id: senderId,
    chat_id: chatId,
    raw_text: clean(rawText),
    parsed_payload: {
      property: parsed,
      validation,
      parser: { name: 'aqarat-deterministic-intake-v3', mode: 'deterministic', created_at: new Date().toISOString() },
    },
  };
}

export function propertyDedupKey(candidate) {
  return [
    normalizedText(candidate.city || ''),
    normalizedText(candidate.district || ''),
    normalizedText(candidate.neighborhood || ''),
    normalizedText(candidate.property_type || ''),
    normalizedText(candidate.transaction_type || ''),
    String(candidate.parcel_number ?? ''),
    String(candidate.area_m2 ?? ''),
    String(candidate.price ?? ''),
    String(candidate.bedrooms ?? ''),
    String(candidate.bathrooms ?? ''),
  ].join('|');
}
