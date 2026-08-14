const DEFAULT_QUERY_TEMPLATE = 'real estate property listings Sadat City Egypt';

const ARABIC_QUERY_TEMPLATES = [
  'عقارات للبيع مدينة السادات',
  'شقق للبيع مدينة السادات',
  'شقق للايجار مدينة السادات',
  'فلل للبيع مدينة السادات',
  'اراضي للبيع مدينة السادات',
  'محلات للبيع مدينة السادات',
];

const ENGLISH_QUERY_TEMPLATES = [
  'apartments for sale Sadat City Egypt',
  'apartments for rent Sadat City Egypt',
  'villas for sale Sadat City Egypt',
  'land for sale Sadat City Egypt',
  'commercial property Sadat City Egypt',
];

function unique(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))];
}

export function buildSadatSearchPlan({ queries = [], maxQueries = 10 } = {}) {
  const seeds = unique([
    ...queries,
    DEFAULT_QUERY_TEMPLATE,
    ...ARABIC_QUERY_TEMPLATES,
    ...ENGLISH_QUERY_TEMPLATES,
  ]);

  return seeds.slice(0, Math.max(1, Math.min(Number(maxQueries) || 10, 20))).map((query, index) => ({
    id: `sadat-q-${index + 1}`,
    city: 'Sadat City',
    country: 'Egypt',
    query,
    priority: index < 3 ? 100 : 80,
    policy: 'source_allowlist_required',
  }));
}

export const DEFAULT_SADAT_QUERIES = [
  ...ARABIC_QUERY_TEMPLATES,
  ...ENGLISH_QUERY_TEMPLATES,
];
