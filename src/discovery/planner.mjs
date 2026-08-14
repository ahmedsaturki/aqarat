const DEFAULT_CITY = 'مدينة السادات';
const DEFAULT_COUNTRY = 'Egypt';

export function buildDiscoveryPlan({ sourceId, sourceKey, query = 'real estate', city = DEFAULT_CITY, country = DEFAULT_COUNTRY, urls = [] } = {}) {
  if (!sourceId && !sourceKey) throw new Error('discovery_source_required');

  const normalizedUrls = [...new Set((Array.isArray(urls) ? urls : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))];

  return {
    city,
    country,
    query: String(query || 'real estate').trim(),
    source_id: sourceId ?? null,
    source_key: sourceKey ?? null,
    targets: normalizedUrls,
    mode: normalizedUrls.length ? 'targeted' : 'source_homepage',
    limits: {
      max_targets: 20,
      max_pages_per_target: 5,
      max_entities_per_run: 100,
    },
  };
}

export function discoveryJobPayload(plan) {
  return {
    source_id: plan.source_id,
    source_key: plan.source_key,
    city: plan.city,
    country: plan.country,
    query: plan.query,
    targets: plan.targets,
    limits: plan.limits,
  };
}
