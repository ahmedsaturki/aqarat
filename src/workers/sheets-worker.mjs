import { propertyToSheetRow } from '../adapters/google-sheets.mjs';

export function buildSheetsProjection(job, property, context = {}) {
  if (!job || job.job_type !== 'google_sheets_projection') {
    throw new Error('unsupported_job_type');
  }
  if (!property?.id) throw new Error('property_required');

  const row = propertyToSheetRow(property, context);
  return {
    job_id: job.id,
    projection_type: 'google_sheets',
    external_key: row.external_key,
    columns: row.columns,
    values: row.values,
  };
}

/**
 * Runtime boundary: pass a transport with an `upsertRow` implementation.
 * No Google credential or network behavior is embedded in the domain worker.
 */
export async function executeSheetsProjection(job, property, transport, context = {}) {
  if (!transport || typeof transport.upsertRow !== 'function') {
    throw new Error('sheets_transport_required');
  }

  const projection = buildSheetsProjection(job, property, context);
  const result = await transport.upsertRow(projection);

  return {
    ...projection,
    result,
  };
}
