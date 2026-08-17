import { dashboardSessionValid } from './login.mjs';
import { rankPropertyMatches, rankPropertyOpportunities } from '../../intelligence/scoring.mjs';
import { timedFetch } from '../../runtime/http.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

function json(res, status, payload) {
  res.status(status).json(payload);
}

function headers() {
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` };
}

async function rows(table, query) {
  const response = await timedFetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!response.ok) throw new Error(`supabase_${table}_${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!dashboardSessionValid(req)) return json(res, 401, { error: 'dashboard_auth_required' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 503, { error: 'intelligence_config_missing' });

  try {
    const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 50);
    const propertyId = String(req.query?.property_id || '').trim();
    const properties = await rows(
      'properties',
      `select=id,title,city,district,property_type,transaction_type,area_m2,price,currency,confidence,status,first_seen_at,last_seen_at,updated_at&order=updated_at.desc&limit=200`,
    );
    const opportunities = rankPropertyOpportunities(properties).slice(0, limit).map((item) => ({
      ...item.intelligence,
      property_id: item.property_id,
      title: item.property?.title ?? null,
      city: item.property?.city ?? null,
      district: item.property?.district ?? null,
    }));

    const payload = {
      ok: true,
      generated_at: new Date().toISOString(),
      opportunities,
    };

    if (propertyId) {
      const property = properties.find((item) => item.id === propertyId);
      if (!property) return json(res, 404, { error: 'property_not_found' });
      const interests = await rows(
        'interests',
        `select=id,person_id,interest_type,property_type,city,district,min_price,max_price,min_area_m2,max_area_m2,intent_score,status,observed_at&order=intent_score.desc nulls last,observed_at.desc&limit=200`,
      );
      payload.property = property;
      payload.matches = rankPropertyMatches(property, interests).slice(0, limit).map((item) => ({
        ...item.match,
        interest_id: item.interest_id,
        person_id: item.interest?.person_id ?? null,
      }));
    }

    return json(res, 200, payload);
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_intelligence_error', error: error.message }));
    return json(res, 500, { error: 'dashboard_intelligence_failed' });
  }
}
