const CITY_ALIASES = [
  'مدينة السادات', 'السادات', 'سادات', 'sadat city', 'el sadat', 'el-sadat', 'alsadat'
];

const DISTRICT_ALIASES = {
  'المنطقة الأولى': ['المنطقة الأولى','المنطقه الاولى','الأولى','الاولي','1st district'],
  'المنطقة الثانية': ['المنطقة الثانية','المنطقه الثانيه','الثانية','الثانيه','2nd district'],
  'المنطقة الثالثة': ['المنطقة الثالثة','المنطقه الثالثه','الثالثة','الثالثه','3rd district'],
  'المنطقة الرابعة': ['المنطقة الرابعة','المنطقه الرابعه','الرابعة','الرابعه','4th district'],
  'المنطقة الخامسة': ['المنطقة الخامسة','المنطقه الخامسه','الخامسة','الخامسه','5th district'],
  'المنطقة السادسة': ['المنطقة السادسة','المنطقه السادسه','السادسة','السادسه','6th district'],
  'المنطقة السابعة': ['المنطقة السابعة','المنطقه السابعه','السابعة','السابعه','7th district'],
  'المنطقة الثامنة': ['المنطقة الثامنة','المنطقه الثامنه','الثامنة','الثامنه','8th district']
};

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }

function normalizedText(value) {
  return clean(value).toLowerCase()
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
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
  const normalized = normalizeDigits(value).replace(/,/g, '').replace(/،/g, '').replace(/\s/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseArea(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(?:مساح(?:ة|ه)|مساحة)\s*(?:=|:|-)?\s*(\d+(?:\.\d+)?)\s*(?:م2|م²|متر(?:\s*مربع)?|sqm|m2)/i,
    /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:م2|م²|متر(?:\s*مربع)?|sqm|m2)/i
  ]);
  return match ? parseNumber(match[1]) : null;
}

function parseParcelNumber(text) {
  const normalized = normalizeDigits(text);
  const match = firstMatch(normalized, [
    /(?:رقم\s*)?(?:القطعة|قطعه)\s*(?:رقم\s*)?(\d+)/i,
    /رقم\s*(\d+)\s*(?:مساحة|متر)/i
  ]);
  return match ? Number(match[1]) : null;
}

function parseInstallmentsClear(text) {
  const n = normalizedText(text);
  return /(خالصة\s*الاقساط|خالصه\s*الاقساط|خلصت\s*الاقساط|مسدد(?:ة|ه)\s*الاقساط)/i.test(n)
    ? true : null;
}

function parseBedrooms(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(\d+)\s*(?:غرف|غرفة|bedrooms?|beds?)/i,
    /(?:غرف|غرفة)\s*(?:عدد\s*)?(\d+)/i
  ]);
  return match ? Number(match[1]) : null;
}

function parseBathrooms(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(\d+)\s*(?:حمام|حمامات|bathrooms?|baths?)/i,
    /(?:حمام|حمامات)\s*(?:عدد\s*)?(\d+)/i
  ]);
  return match ? Number(match[1]) : null;
}

function parseFloor(text) {
  const match = firstMatch(normalizeDigits(text), [
    /(?:الدور|طابق|floor)\s*([\wء-ي-]+)/i,
    /(?:floor\s*)(\d+)/i
  ]);
  return match ? clean(match[1]) : null;
}

function parsePrice(text) {
  const normalized = normalizeDigits(text);
  let match = firstMatch(normalized, [
    /(\d[\d,]*(?:\.\d+)?)\s*(مليار|billion)\s*(\d{1,3})\s*(?:جنيه|ج|egp|pounds?)?/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(مليون|million)\s*(\d{1,3})\s*(?:جنيه|ج|egp|pounds?)?/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(مليون|مليار|ألف|الف|million|billion|k)/i,
    /(?:للبيع|بيع|مطلوب|مطلوب\s*نهائي|نهائي|السعر|بسعر|price)\s*[:：-]?\s*(\d[\d,]*(?:\.\d+)?)/i,
    /(?:جنيه|ج|egp|pounds?)\s*(\d[\d,]*(?:\.\d+)?)/i
  ]);
  if (!match) return { price: null, currency: null };

  let amount = parseNumber(match[1]);
  if (amount == null) return { price: null, currency: null };

  const unit = normalizedText(match[2] || '');
  const tail = match[3] ? parseNumber(match[3]) : null;
  if (unit === 'مليون' || unit === 'million') amount *= 1_000_000;
  else if (unit === 'مليار' || unit === 'billion') amount *= 1_000_000_000;
  else if (unit === 'الف' || unit === 'k') amount *= 1_000;

  // Egyptian real-estate shorthand: "7 million 100" means 7,100,000.
  if (tail != null && (unit === 'مليون' || unit === 'million')) amount += tail * 1_000;
  if (tail != null && (unit === 'مليار' || unit === 'billion')) amount += tail * 1_000_000;

  return { price: amount, currency: 'EGP' };
}

function parseTransactionType(text) {
  const n = normalizedText(text);
  const sale = /(للبيع|بيع|مطلوب بيع|sale|for sale)/i.test(n);
  const rent = /(للايجار|للتاجير|ايجار|تاجير|rent|for rent)/i.test(n);
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
    ['super_lux', /سوبر لوكس|super\s*lux/i], ['lux', /لوكس|lux/i], ['good', /تشطيب جيد|جيد/i],
    ['semi_finished', /نصف تشطيب|semi[- ]?finished/i], ['unfinished', /على الطوب الاحمر|طوب احمر|unfinished/i],
    ['fully_finished', /تشطيب كامل|fully finished/i]
  ];
  return values.find(([, re]) => re.test(n))?.[0] ?? null;
}

function parseContact(text) {
  const normalized = normalizeDigits(text);
  const phone = normalized.match(/(?:\+?20\s?)?(?:01\d{9}|0?1\d{9}|1\d{9})/);
  if (!phone) return null;
  const digits = phone[0].replace(/\D/g, '');
  const e164 = digits.startsWith('20') ? `+${digits}` : `+20${digits.replace(/^0/, '')}`;
  return { value: phone[0].trim(), normalized_value: e164 };
}

function parseDistrict(text) {
  const n = normalizedText(text);
  const numbered = n.match(/المنطقه\s*(\d{1,2})/i);
  if (numbered) return `المنطقة ${Number(numbered[1])}`;
  for (const [canonical, aliases] of Object.entries(DISTRICT_ALIASES)) {
    if (aliases.some((alias) => n.includes(normalizedText(alias)))) return canonical;
  }
  return null;
}

function parseCity(text) {
  const n = normalizedText(text);
  return CITY_ALIASES.some((alias) => n.includes(normalizedText(alias))) ? 'مدينة السادات' : null;
}

function inferTitle(parsed) {
  const type = parsed.property_type === 'unknown' ? 'عقار' : parsed.property_type;
  const action = parsed.transaction_type === 'rent' ? 'للإيجار' : parsed.transaction_type === 'sale' ? 'للبيع' : 'عقاري';
  return `${type} ${action} — ${parsed.city || 'غير محدد'}`;
}

function confidenceFor(parsed) {
  const checks = [Boolean(parsed.city), parsed.property_type !== 'unknown', parsed.transaction_type !== 'unknown',
    parsed.area_m2 != null, parsed.price != null, parsed.bedrooms != null, parsed.bathrooms != null,
    Boolean(parsed.district), Boolean(parsed.parcel_number), Boolean(parsed.contacts?.length)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100;
}

export function parseNaturalLanguageProperty(rawText) {
  const raw = clean(rawText);
  if (!raw) throw new Error('raw_text_required');
  const price = parsePrice(raw);
  const contact = parseContact(raw);
  const parsed = {
    property_type: parsePropertyType(raw), transaction_type: parseTransactionType(raw), status: 'active',
    title: null, description: raw, city: parseCity(raw), district: parseDistrict(raw), neighborhood: null,
    address: null, latitude: null, longitude: null, area_m2: parseArea(raw), bedrooms: parseBedrooms(raw),
    bathrooms: parseBathrooms(raw), floor: parseFloor(raw), finishing: parseFinishing(raw), price: price.price,
    currency: price.currency || 'EGP', features: {}, confidence: 0, contacts: contact ? [contact] : [],
    parcel_number: parseParcelNumber(raw), installments_clear: parseInstallmentsClear(raw), unknown_fields: []
  };
  if (parsed.parcel_number != null) parsed.features.parcel_number = parsed.parcel_number;
  if (parsed.installments_clear != null) parsed.features.installments_clear = parsed.installments_clear;
  parsed.title = inferTitle(parsed);
  parsed.confidence = confidenceFor(parsed);
  for (const [key, value] of Object.entries(parsed)) {
    if (['title','description','currency','features','contacts','unknown_fields','confidence','status','parcel_number','installments_clear'].includes(key)) continue;
    if (value == null || value === 'unknown') parsed.unknown_fields.push(key);
  }
  const validation = validatePropertyCandidate(parsed);
  return { parsed, validation };
}

export function validatePropertyCandidate(candidate) {
  const errors = [], warnings = [];
  if (!candidate.city) errors.push('city_required');
  if (candidate.city && normalizedText(candidate.city) !== normalizedText('مدينة السادات')) errors.push('unsupported_city');
  if (candidate.price != null && candidate.price <= 0) errors.push('price_invalid');
  if (candidate.area_m2 != null && candidate.area_m2 <= 0) errors.push('area_invalid');
  if (candidate.parcel_number != null && candidate.parcel_number <= 0) errors.push('parcel_number_invalid');
  if (candidate.bedrooms != null && candidate.bedrooms < 0) errors.push('bedrooms_invalid');
  if (candidate.bathrooms != null && candidate.bathrooms < 0) errors.push('bathrooms_invalid');
  if (!candidate.contacts?.length) warnings.push('no_contact_found');
  if (candidate.property_type === 'unknown') warnings.push('property_type_unknown');
  if (candidate.transaction_type === 'unknown') warnings.push('transaction_type_unknown');
  if (candidate.area_m2 == null) warnings.push('area_missing');
  if (candidate.price == null) warnings.push('price_missing');
  if (candidate.parcel_number == null && candidate.property_type === 'land') warnings.push('parcel_number_missing');
  return { valid: errors.length === 0, errors, warnings };
}

export function buildIntakeEvent({ channel = 'other', externalEventId = null, senderId = null, chatId = null, rawText }) {
  const { parsed, validation } = parseNaturalLanguageProperty(rawText);
  return { channel, external_event_id: externalEventId, sender_id: senderId, chat_id: chatId, raw_text: clean(rawText), parsed_payload: {
    property: parsed, validation, parser: { name: 'aqarat-deterministic-intake-v2', mode: 'deterministic', created_at: new Date().toISOString() }
  }};
}

export function propertyDedupKey(candidate) {
  const base = [normalizedText(candidate.city || ''), normalizedText(candidate.property_type || ''), normalizedText(candidate.transaction_type || '')];
  if (candidate.parcel_number != null) return [...base, `parcel:${candidate.parcel_number}`].join('|');
  return [...base, normalizedText(candidate.district || ''), normalizedText(candidate.neighborhood || ''), String(candidate.area_m2 ?? ''), String(candidate.price ?? ''), String(candidate.bedrooms ?? ''), String(candidate.bathrooms ?? '')].join('|');
}
