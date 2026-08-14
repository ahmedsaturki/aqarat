const CITY_ALIASES = [
  'مدينة السادات',
  'السادات',
  'سادات',
  'sadat city',
  'el sadat',
  'el-sadat',
  'alsadat'
];

const DISTRICT_ALIASES = {
  'المنطقة السابعة': ['المنطقة السابعة', 'السابعة', '7th district'],
  'المنطقة الثامنة': ['المنطقة الثامنة', 'الثامنة', '8th district'],
  'المنطقة الأولى': ['المنطقة الأولى', 'الأولى', '1st district'],
  'المنطقة الثانية': ['المنطقة الثانية', 'الثانية', '2nd district'],
  'المنطقة الثالثة': ['المنطقة الثالثة', 'الثالثة', '3rd district'],
  'المنطقة الرابعة': ['المنطقة الرابعة', 'الرابعة', '4th district'],
  'المنطقة الخامسة': ['المنطقة الخامسة', 'الخامسة', '5th district'],
  'المنطقة السادسة': ['المنطقة السادسة', 'السادسة', '6th district']
};

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function firstMatch(text, patterns) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of list) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseNumber(value) {
  if (value == null) return null;
  const normalized = String(value)
    .replace(/,/g, '')
    .replace(/،/g, '')
    .replace(/\s/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseArea(text) {
  const match = firstMatch(text, /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:م2|م²|متر(?:\s*مربع)?|sqm|m2)\b/i);
  return match ? parseNumber(match[1]) : null;
}

function parseBedrooms(text) {
  const match = firstMatch(text, [
    /(\d+)\s*(?:غرف|غرفة|bedrooms?|beds?)\b/i,
    /(?:غرف|غرفة)\s*(?:عدد\s*)?(\d+)/i
  ]);
  return match ? Number(match[1]) : null;
}

function parseBathrooms(text) {
  const match = firstMatch(text, [
    /(\d+)\s*(?:حمام|حمامات|bathrooms?|baths?)\b/i,
    /(?:حمام|حمامات)\s*(?:عدد\s*)?(\d+)/i
  ]);
  return match ? Number(match[1]) : null;
}

function parseFloor(text) {
  const match = firstMatch(text, [
    /(?:الدور|طابق|floor)\s*([\wء-ي-]+)/i,
    /(?:floor\s*)(\d+)/i
  ]);
  return match ? clean(match[1]) : null;
}

function parsePrice(text) {
  const priced = firstMatch(text, [
    /(\d[\d,،]*(?:\.\d+)?)\s*(مليون|مليار|ألف|الف|million|billion|k)/i,
    /(?:للبيع|بيع|السعر|بسعر|price)\s*[:：-]?\s*(\d[\d,،]*(?:\.\d+)?)/i,
    /(?:جنيه|ج|egp|pounds?)\s*(\d[\d,،]*(?:\.\d+)?)/i
  ]);
  if (!priced) return { price: null, currency: null };

  let amount = parseNumber(priced[1]);
  if (amount == null) return { price: null, currency: null };

  const unit = normalizedText(priced[2] || '');
  if (unit === 'مليون' || unit === 'million') amount *= 1_000_000;
  else if (unit === 'مليار' || unit === 'billion') amount *= 1_000_000_000;
  else if (unit === 'الف' || unit === 'k') amount *= 1_000;

  return { price: amount, currency: 'EGP' };
}

function parseTransactionType(text) {
  const n = normalizedText(text);
  const sale = /(للبيع|بيع|مطلوب بيع|sale|for sale)/i.test(n);
  const rent = /(للايجار|للتأجير|ايجار|تأجير|rent|for rent)/i.test(n);
  if (sale && rent) return 'both';
  if (sale) return 'sale';
  if (rent) return 'rent';
  return 'unknown';
}

function parsePropertyType(text) {
  const n = normalizedText(text);
  if (/شقه|apartment|flat/i.test(n)) return 'apartment';
  if (/فيلا|villa/i.test(n)) return 'villa';
  if (/تاون هاوس|townhouse/i.test(n)) return 'townhouse';
  if (/توين هاوس|twin house/i.test(n)) return 'twin_house';
  if (/مكتب|اداري|office|administrative/i.test(n)) return 'office';
  if (/محل|shop|store|retail/i.test(n)) return 'shop';
  if (/ارض|أرض|land/i.test(n)) return 'land';
  if (/مخزن|warehouse|storage/i.test(n)) return 'warehouse';
  if (/عماره|عمارة|building/i.test(n)) return 'building';
  return 'unknown';
}

function parseFinishing(text) {
  const n = normalizedText(text);
  const values = [
    ['super_lux', /سوبر لوكس|super\s*lux/i],
    ['lux', /لوكس|lux/i],
    ['good', /تشطيب جيد|جيد/i],
    ['semi_finished', /نصف تشطيب|semi[- ]?finished/i],
    ['unfinished', /على الطوب الاحمر|طوب احمر|unfinished/i],
    ['fully_finished', /تشطيب كامل|fully finished/i]
  ];
  return values.find(([, re]) => re.test(n))?.[0] ?? null;
}

function parseContact(text) {
  const phone = text.match(/(?:\+?20\s?)?(?:01\d{9}|0?1\d{9}|1\d{9})/);
  if (!phone) return null;
  const digits = phone[0].replace(/\D/g, '');
  const normalized = digits.startsWith('20') ? `+${digits}` : `+20${digits.replace(/^0/, '')}`;
  return {
    value: phone[0].trim(),
    normalized_value: normalized
  };
}

function parseDistrict(text) {
  const n = normalizedText(text);
  for (const [canonical, aliases] of Object.entries(DISTRICT_ALIASES)) {
    if (aliases.some((alias) => n.includes(normalizedText(alias)))) return canonical;
  }
  return null;
}

function parseCity(text) {
  const n = normalizedText(text);
  return CITY_ALIASES.some((alias) => n.includes(normalizedText(alias)))
    ? 'مدينة السادات'
    : null;
}

function inferTitle(parsed) {
  const type = parsed.property_type === 'unknown' ? 'عقار' : parsed.property_type;
  const action = parsed.transaction_type === 'rent' ? 'للإيجار' : parsed.transaction_type === 'sale' ? 'للبيع' : 'عقاري';
  return `${type} ${action} — ${parsed.city || 'غير محدد'}`;
}

function confidenceFor(parsed) {
  const checks = [
    Boolean(parsed.city),
    parsed.property_type !== 'unknown',
    parsed.transaction_type !== 'unknown',
    parsed.area_m2 != null,
    parsed.price != null,
    parsed.bedrooms != null,
    parsed.bathrooms != null,
    Boolean(parsed.district),
    Boolean(parsed.contacts?.length)
  ];
  const score = checks.filter(Boolean).length / checks.length;
  return Math.round(score * 100) / 100;
}

export function parseNaturalLanguageProperty(rawText) {
  const raw = clean(rawText);
  if (!raw) throw new Error('raw_text_required');

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
    unknown_fields: []
  };

  parsed.title = inferTitle(parsed);
  parsed.confidence = confidenceFor(parsed);

  for (const [key, value] of Object.entries(parsed)) {
    if (['title', 'description', 'currency', 'features', 'contacts', 'unknown_fields', 'confidence', 'status'].includes(key)) continue;
    if (value == null || value === 'unknown') parsed.unknown_fields.push(key);
  }

  const validation = validatePropertyCandidate(parsed);
  return { parsed, validation };
}

export function validatePropertyCandidate(candidate) {
  const errors = [];
  const warnings = [];

  if (!candidate.city) errors.push('city_required');
  if (candidate.city && normalizedText(candidate.city) !== normalizedText('مدينة السادات')) {
    errors.push('unsupported_city');
  }
  if (candidate.price != null && candidate.price <= 0) errors.push('price_invalid');
  if (candidate.area_m2 != null && candidate.area_m2 <= 0) errors.push('area_invalid');
  if (candidate.bedrooms != null && candidate.bedrooms < 0) errors.push('bedrooms_invalid');
  if (candidate.bathrooms != null && candidate.bathrooms < 0) errors.push('bathrooms_invalid');
  if (!candidate.contacts?.length) warnings.push('no_contact_found');
  if (candidate.property_type === 'unknown') warnings.push('property_type_unknown');
  if (candidate.transaction_type === 'unknown') warnings.push('transaction_type_unknown');

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
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
      parser: {
        name: 'aqarat-deterministic-intake-v1',
        mode: 'deterministic',
        created_at: new Date().toISOString()
      }
    }
  };
}

export function propertyDedupKey(candidate) {
  return [
    normalizedText(candidate.city || ''),
    normalizedText(candidate.district || ''),
    normalizedText(candidate.neighborhood || ''),
    normalizedText(candidate.property_type || ''),
    normalizedText(candidate.transaction_type || ''),
    String(candidate.area_m2 ?? ''),
    String(candidate.price ?? ''),
    String(candidate.bedrooms ?? ''),
    String(candidate.bathrooms ?? '')
  ].join('|');
}
