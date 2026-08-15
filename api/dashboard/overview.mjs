import { dashboardSessionValid } from './login.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

function json(res, status, payload) {
  res.status(status).json(payload);
}

async function count(table, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`;
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'count=exact',
    },
  });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/').pop());
  return Number.isFinite(total) ? total : 0;
}

async function rows(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'supabase_dashboard_config_missing' });

  try {
    const [properties, leads, sources, reviews, jobs, publications, discoveryRuns, intakeEvents] = await Promise.all([
      count('properties'),
      count('leads'),
      count('discovery_sources', '&status=eq.active'),
      count('review_queue', '&status=eq.pending'),
      count('jobs', '&status=in.(queued,running,retry)'),
      count('publication_jobs', '&status=in.(queued,running)'),
      count('discovery_runs', '&status=in.(queued,running)'),
      count('intake_events', '&status=eq.processed'),
    ]);

    const recentProperties = await rows('properties', 'select=id,title,city,district,property_type,transaction_type,area_m2,price,currency,confidence,status,updated_at&order=updated_at.desc&limit=25');
    const recentJobs = await rows('jobs', 'select=id,job_type,status,attempts,run_after,error_message,created_at,updated_at&order=updated_at.desc&limit=20');

    return json(res, 200, {
      ok: true,
      generated_at: new Date().toISOString(),
      metrics: {
        properties, leads, active_sources: sources, pending_reviews: reviews,
        active_jobs: jobs, active_publications: publications,
        active_discovery_runs: discoveryRuns, processed_intakes: intakeEvents,
      },
      recent_properties: recentProperties,
      recent_jobs: recentJobs,
      privacy: {
        price: 'internal_dashboard_only',
        owner_identity: 'internal_only',
        public_contact_policy: 'configured_brand_only',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_overview_error', error: error.message }));
    return json(res, 500, { error: 'dashboard_overview_failed' });
  }
}
