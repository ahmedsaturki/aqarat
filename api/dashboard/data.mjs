import { dashboardSessionValid } from './login.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const TABLES = new Set([
  'properties','leads','discovery_sources','discovery_runs','review_queue','publication_jobs','jobs',
  'interests','interactions','content_items','content_variants','content_performance','marketing_experiments',
]);

function json(res, status, payload) { res.status(status).json(payload); }
function headers(extra = {}) {
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

async function rows(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  return response.json();
}

async function count(table, filter = '') {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
    headers: headers({ Prefer: 'count=exact' }),
  });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/').pop());
  return Number.isFinite(total) ? total : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'supabase_dashboard_config_missing' });

  const view = String(req.query?.view || 'all');
  try {
    if (view === 'all' || view === 'kpis') {
      const [properties, leads, sources, reviews, jobs, publications, discoveryRuns, intakes, interests, interactions] = await Promise.all([
        count('properties'), count('leads'), count('discovery_sources', '&enabled=eq.true'), count('review_queue', '&status=eq.pending'),
        count('jobs', '&status=in.(queued,running,retry)'), count('publication_jobs', '&status=in.(queued,running)'),
        count('discovery_runs', '&status=in.(queued,running)'), count('intake_events', '&status=eq.processed'), count('interests'), count('interactions'),
      ]);
      if (view === 'kpis') return json(res, 200, { ok: true, metrics: { properties, leads, active_sources: sources, pending_reviews: reviews, active_jobs: jobs, active_publications: publications, active_discovery_runs: discoveryRuns, processed_intakes: intakes, interests, interactions } });
    }

    const payload = {};
    if (view === 'all' || view === 'properties') payload.properties = await rows('properties', 'select=id,title,city,district,property_type,transaction_type,area_m2,price,currency,confidence,status,parcel_number,canonical_key,updated_at&order=updated_at.desc&limit=100');
    if (view === 'all' || view === 'leads') payload.leads = await rows('leads', 'select=id,person_id,property_id,intent,source,score,status,notes,created_at,updated_at&order=updated_at.desc&limit=100');
    if (view === 'all' || view === 'discovery') {
      payload.discovery_sources = await rows('discovery_sources', 'select=id,key,name,base_url,source_type,enabled,policy_mode,config,updated_at&order=name.asc');
      payload.discovery_runs = await rows('discovery_runs', 'select=id,source_id,status,query,city,country,started_at,finished_at,stats,error_message,created_at&order=created_at.desc&limit=100');
    }
    if (view === 'all' || view === 'review') payload.review_queue = await rows('review_queue', 'select=id,object_type,object_id,queue_type,status,priority,checks,decision,notes,created_at,reviewed_at&order=priority.desc,created_at.asc&limit=100');
    if (view === 'all' || view === 'content') {
      payload.content_items = await rows('content_items', 'select=id,property_id,audience,channel,language,title,status,ai_model,prompt_version,quality_score,created_at,updated_at&order=updated_at.desc&limit=100');
      payload.content_variants = await rows('content_variants', 'select=id,content_item_id,channel,locale,variant_type,body,status,metadata,created_at,updated_at&order=updated_at.desc&limit=100');
    }
    if (view === 'all' || view === 'publications') payload.publication_jobs = await rows('publication_jobs', 'select=id,content_variant_id,channel,destination,status,requires_human,attempts,max_attempts,last_error,available_at,started_at,finished_at,created_at&order=created_at.desc&limit=100');
    if (view === 'all' || view === 'jobs') payload.jobs = await rows('jobs', 'select=id,job_type,status,priority,attempts,max_attempts,available_at,started_at,finished_at,error_message,created_at,updated_at&order=updated_at.desc&limit=100');
    if (view === 'all' || view === 'insights') {
      const [performance, experiments, interests, interactions] = await Promise.all([
        rows('content_performance', 'select=id,content_variant_id,channel,impressions,views,replies,qualified_inquiries,conversions,last_observed_at&order=last_observed_at.desc&limit=100'),
        rows('marketing_experiments', 'select=id,name,hypothesis,audience,funnel_stage,primary_metric,status,created_at,updated_at&order=updated_at.desc&limit=100'),
        rows('interests', 'select=id,person_id,interest_type,property_type,city,district,min_price,max_price,min_area_m2,max_area_m2,intent_score,status,observed_at&order=observed_at.desc&limit=100'),
        rows('interactions', 'select=id,person_id,property_id,channel,interaction_type,direction,content_ref,external_event_id,observed_at&order=observed_at.desc&limit=100'),
      ]);
      payload.content_performance = performance; payload.marketing_experiments = experiments; payload.interests = interests; payload.interactions = interactions;
    }

    return json(res, 200, { ok: true, generated_at: new Date().toISOString(), ...payload });
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_data_error', view, error: error.message }));
    return json(res, 500, { error: 'dashboard_data_failed' });
  }
}
