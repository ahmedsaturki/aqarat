import { dashboardSessionValid } from './login.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const TABLES = new Set([
  'properties', 'leads', 'discovery_sources', 'discovery_runs', 'review_queue', 'publication_jobs', 'jobs',
  'interests', 'interactions', 'content_items', 'content_variants', 'content_performance', 'marketing_experiments', 'audit_events', 'intake_events',
]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000_000;

function correlationId(req) {
  const value = String(req?.aqaratCorrelationId || '').trim();
  return value || null;
}

function json(res, status, payload, requestCorrelationId = null) {
  res.status(status).json({
    ...payload,
    ...(requestCorrelationId ? { correlation_id: requestCorrelationId } : {}),
  });
}

function headers(extra = {}) {
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

function queryValue(req, name) {
  const fromQuery = req?.query?.[name];
  if (fromQuery != null) return Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  try { return new URL(req?.url || '/', 'http://localhost').searchParams.get(name); } catch { return null; }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

async function rows(table, query, page) {
  if (!TABLES.has(table)) throw new Error('dashboard_table_not_allowed');
  const pageQuery = page ? `&limit=${page.limit + 1}&offset=${page.offset}` : '';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}${pageQuery}`, { headers: headers() });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  const body = await response.json();
  const items = Array.isArray(body) ? body : [];
  if (!page) return { items, page: null };
  const hasMore = items.length > page.limit;
  const pageItems = hasMore ? items.slice(0, page.limit) : items;
  return {
    items: pageItems,
    page: {
      limit: page.limit,
      offset: page.offset,
      returned: pageItems.length,
      has_more: hasMore,
      next_offset: hasMore ? page.offset + page.limit : null,
    },
  };
}

async function count(table, filter = '') {
  if (!TABLES.has(table)) throw new Error('dashboard_table_not_allowed');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, { headers: headers({ Prefer: 'count=exact' }) });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/').pop());
  return Number.isFinite(total) ? total : 0;
}

export default async function handler(req, res) {
  const requestCorrelationId = correlationId(req);
  const startedAt = Date.now();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' }, requestCorrelationId);
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' }, requestCorrelationId);
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'supabase_dashboard_config_missing' }, requestCorrelationId);

  const view = String(queryValue(req, 'view') || 'all');
  const limit = boundedInteger(queryValue(req, 'limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = boundedInteger(queryValue(req, 'offset'), 0, 0, MAX_OFFSET);
  const pagination = {};
  const page = { limit, offset };
  const readPage = async (table, query, key = table) => {
    const result = await rows(table, query, page);
    pagination[key] = result.page;
    return result.items;
  };

  console.info(JSON.stringify({ event: 'dashboard_data_started', view, limit, offset, correlation_id: requestCorrelationId }));
  try {
    if (view === 'all' || view === 'kpis') {
      const [properties, leads, sources, reviews, jobs, publications, discoveryRuns, intakes, interests, interactions, audits] = await Promise.all([
        count('properties'), count('leads'), count('discovery_sources', '&enabled=eq.true'), count('review_queue', '&status=eq.pending'),
        count('jobs', '&status=in.(queued,running)'), count('publication_jobs', '&status=in.(queued,running)'),
        count('discovery_runs', '&status=in.(queued,running)'), count('intake_events', '&status=eq.processed'), count('interests'), count('interactions'), count('audit_events'),
      ]);
      if (view === 'kpis') {
        const response = { ok: true, metrics: { properties, leads, active_sources: sources, pending_reviews: reviews, active_jobs: jobs, active_publications: publications, active_discovery_runs: discoveryRuns, processed_intakes: intakes, interests, interactions, audit_events: audits } };
        console.info(JSON.stringify({ event: 'dashboard_data_completed', view, duration_ms: Date.now() - startedAt, correlation_id: requestCorrelationId }));
        return json(res, 200, response, requestCorrelationId);
      }
    }

    const payload = {};
    if (view === 'all' || view === 'properties') payload.properties = await readPage('properties', 'select=id,title,city,district,property_type,transaction_type,area_m2,price,currency,confidence,status,parcel_number,canonical_key,updated_at&order=updated_at.desc');
    if (view === 'all' || view === 'leads') payload.leads = await readPage('leads', 'select=id,person_id,property_id,intent,source,score,status,created_at,updated_at&order=updated_at.desc');
    if (view === 'all' || view === 'discovery') {
      payload.discovery_sources = await readPage('discovery_sources', 'select=id,key,name,base_url,source_type,enabled,policy_mode,updated_at&order=name.asc');
      payload.discovery_runs = await readPage('discovery_runs', 'select=id,source_id,status,query,city,country,started_at,finished_at,stats,error_message,created_at&order=created_at.desc');
    }
    if (view === 'all' || view === 'review') payload.review_queue = await readPage('review_queue', 'select=id,object_type,object_id,queue_type,status,priority,decision,created_at,reviewed_at&order=priority.desc,created_at.asc');
    if (view === 'all' || view === 'content') {
      payload.content_items = await readPage('content_items', 'select=id,property_id,audience,channel,language,title,status,ai_model,prompt_version,quality_score,created_at,updated_at&order=updated_at.desc');
      payload.content_variants = await readPage('content_variants', 'select=id,content_item_id,channel,locale,variant_type,status,created_at,updated_at&order=updated_at.desc');
    }
    if (view === 'all' || view === 'publications') payload.publication_jobs = await readPage('publication_jobs', 'select=id,content_variant_id,channel,destination,status,requires_human,attempts,max_attempts,last_error,available_at,started_at,finished_at,created_at&order=created_at.desc');
    if (view === 'all' || view === 'jobs') payload.jobs = await readPage('jobs', 'select=id,job_type,status,priority,attempts,max_attempts,available_at,started_at,finished_at,error_message,created_at,updated_at&order=updated_at.desc');
    if (view === 'all' || view === 'insights') {
      const [performance, experiments, interests, interactions] = await Promise.all([
        readPage('content_performance', 'select=id,content_variant_id,channel,impressions,views,replies,qualified_inquiries,conversions,last_observed_at&order=last_observed_at.desc'),
        readPage('marketing_experiments', 'select=id,name,hypothesis,audience,funnel_stage,primary_metric,status,created_at,updated_at&order=updated_at.desc'),
        readPage('interests', 'select=id,person_id,interest_type,property_type,city,district,min_price,max_price,min_area_m2,max_area_m2,intent_score,status,observed_at&order=observed_at.desc'),
        readPage('interactions', 'select=id,person_id,property_id,channel,interaction_type,direction,content_ref,external_event_id,observed_at&order=observed_at.desc'),
      ]);
      payload.content_performance = performance;
      payload.marketing_experiments = experiments;
      payload.interests = interests;
      payload.interactions = interactions;
    }
    if (view === 'all' || view === 'audit') payload.audit_events = await readPage('audit_events', 'select=id,event_type,entity_type,entity_id,actor_type,actor_id,correlation_id,created_at&order=created_at.desc');

    const response = { ok: true, generated_at: new Date().toISOString(), view, limit, offset, pagination, ...payload };
    console.info(JSON.stringify({ event: 'dashboard_data_completed', view, limit, offset, duration_ms: Date.now() - startedAt, correlation_id: requestCorrelationId }));
    return json(res, 200, response, requestCorrelationId);
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_data_error', view, limit, offset, duration_ms: Date.now() - startedAt, correlation_id: requestCorrelationId, error: error.message }));
    return json(res, 500, { error: 'dashboard_data_failed', retryable: true }, requestCorrelationId);
  }
}
