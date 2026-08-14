import { buildSheetsProjection } from '../workers/sheets-worker.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
const GOOGLE_SHEETS_WEBHOOK_SECRET = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || '';

function requireConfig() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL_required');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_required');
}

async function supabase(path, options = {}) {
  requireConfig();
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`supabase_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function claimJob(workerId = 'vercel-sheets-worker') {
  const rows = await supabase('/rest/v1/rpc/claim_job', {
    method: 'POST',
    body: JSON.stringify({
      p_worker: workerId,
      p_job_type: 'google_sheets_projection',
      p_lease_seconds: 300,
    }),
  });
  return rows?.[0] ?? null;
}

async function getProperty(propertyId) {
  const rows = await supabase(
    `/rest/v1/properties?id=eq.${encodeURIComponent(propertyId)}&select=*`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

async function getPrimaryContact(propertyId) {
  const links = await supabase(
    `/rest/v1/property_people?property_id=eq.${encodeURIComponent(propertyId)}&select=person_id,relationship,confidence`,
    { method: 'GET' },
  );
  const seller = links?.find((item) => item.relationship === 'seller') ?? links?.[0];
  if (!seller?.person_id) return null;

  const contacts = await supabase(
    `/rest/v1/contacts?person_id=eq.${encodeURIComponent(seller.person_id)}&order=is_primary.desc,created_at.asc&limit=5&select=person_id,contact_type,value,normalized_value,is_primary,verified,confidence`,
    { method: 'GET' },
  );

  const people = await supabase(
    `/rest/v1/people?id=eq.${encodeURIComponent(seller.person_id)}&select=id,full_name,city,role`,
    { method: 'GET' },
  );

  const person = people?.[0] ?? null;
  const phone = contacts?.find((c) => c.contact_type === 'phone') ?? contacts?.[0] ?? null;

  return {
    name: person?.full_name ?? '',
    phone: phone?.normalized_value ?? phone?.value ?? '',
  };
}

async function updateJob(jobId, patch) {
  return supabase(`/rest/v1/jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function updateProjection(propertyId, patch) {
  return supabase(
    `/rest/v1/sync_projections?entity_type=eq.property&entity_id=eq.${encodeURIComponent(propertyId)}&projection_type=eq.google_sheets`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
  );
}

async function deliverProjection(projection) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    const error = new Error('GOOGLE_SHEETS_WEBHOOK_URL_required');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      operation: 'upsert_property',
      secret: GOOGLE_SHEETS_WEBHOOK_SECRET,
      external_key: projection.external_key,
      columns: projection.columns,
      values: projection.values,
    }),
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    const error = new Error(`sheets_transport_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export async function processOneSheetsJob(workerId = 'vercel-sheets-worker') {
  const job = await claimJob(workerId);
  if (!job) return { processed: false, reason: 'no_job' };

  const propertyId = job.payload?.entity_id;
  try {
    const property = await getProperty(propertyId);
    if (!property) throw new Error('property_not_found');

    const primaryContact = await getPrimaryContact(propertyId);
    const projection = buildSheetsProjection(job, property, {
      primary_contact: primaryContact,
      source_channel: 'telegram',
      source_event_id: job.payload?.intake_event_id ?? null,
    });

    const transportResult = await deliverProjection(projection);
    const now = new Date().toISOString();

    await updateJob(job.id, {
      status: 'succeeded',
      result: transportResult ?? { ok: true },
      finished_at: now,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
      updated_at: now,
    });

    await updateProjection(propertyId, {
      status: 'synced',
      external_key: projection.external_key,
      last_error: null,
      last_synced_at: now,
      updated_at: now,
    });

    return { processed: true, job_id: job.id, property_id: propertyId, result: transportResult ?? null };
  } catch (error) {
    const message = error?.message || 'sheets_projection_failed';
    const permanent = error?.code === 'CONFIG_MISSING';
    const terminal = permanent || Number(job.attempts || 0) >= Number(job.max_attempts || 5);
    const now = new Date().toISOString();
    const patch = terminal
      ? {
          status: 'failed',
          error_message: message,
          finished_at: now,
        }
      : {
          status: 'queued',
          error_message: message,
          available_at: new Date(Date.now() + 60_000).toISOString(),
        };

    await updateJob(job.id, {
      ...patch,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
      updated_at: now,
    });

    await updateProjection(propertyId, {
      status: terminal ? 'error' : 'pending',
      last_error: message,
      updated_at: now,
    });

    return { processed: false, job_id: job.id, property_id: propertyId, error: message, terminal };
  }
}

export async function processSheetsJobs(maxJobs = 3, workerId = 'vercel-sheets-worker') {
  const results = [];
  for (let i = 0; i < Math.max(1, Math.min(Number(maxJobs) || 1, 10)); i += 1) {
    const result = await processOneSheetsJob(workerId);
    results.push(result);
    if (!result.processed && result.reason === 'no_job') break;
  }
  return results;
}
