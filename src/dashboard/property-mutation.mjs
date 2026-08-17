const MUTABLE_FIELDS = Object.freeze([
  'property_type', 'transaction_type', 'status', 'title', 'description', 'city', 'district',
  'neighborhood', 'address', 'area_m2', 'bedrooms', 'bathrooms', 'floor', 'finishing',
  'price', 'currency', 'features',
]);

const ENUMS = Object.freeze({
  transaction_type: new Set(['sale', 'rent', 'both', 'unknown']),
  status: new Set(['active', 'inactive', 'sold', 'rented', 'archived', 'unknown']),
});

const TEXT_LIMITS = Object.freeze({
  property_type: 80, title: 240, description: 4000, city: 120, district: 160,
  neighborhood: 160, address: 300, floor: 40, finishing: 120, currency: 8,
});

function boundedText(value, field) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, TEXT_LIMITS[field] || 160);
}

function boundedNumber(value, field, min, max) {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return { error: `${field}_invalid` };
  return number;
}

function normalizeFeatures(value) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'features_invalid' };
  const entries = Object.entries(value).slice(0, 40).map(([key, entry]) => [String(key).slice(0, 80), typeof entry === 'string' ? entry.slice(0, 240) : Boolean(entry)]);
  return Object.fromEntries(entries);
}

export function validatePropertyMutation(input, { mode = 'update' } = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (!['create', 'update', 'archive'].includes(mode)) return { ok: false, errors: ['mutation_mode_invalid'] };
  const changes = {};
  const errors = [];
  if (mode !== 'create' && !/^[0-9a-f-]{36}$/i.test(String(body.id || ''))) errors.push('property_id_invalid');
  if (mode === 'archive') return errors.length ? { ok: false, errors } : { ok: true, mode, id: String(body.id), changes: { status: 'archived' } };
  for (const field of MUTABLE_FIELDS) {
    if (!(field in body)) continue;
    if (ENUMS[field] && !ENUMS[field].has(String(body[field]))) { errors.push(`${field}_invalid`); continue; }
    if (TEXT_LIMITS[field]) { changes[field] = boundedText(body[field], field); continue; }
    if (field === 'area_m2') { const value = boundedNumber(body[field], field, 0, 1000000); if (value?.error) errors.push(value.error); else changes[field] = value; continue; }
    if (field === 'price') { const value = boundedNumber(body[field], field, 0, 1000000000000); if (value?.error) errors.push(value.error); else changes[field] = value; continue; }
    if (field === 'bedrooms' || field === 'bathrooms') { const value = boundedNumber(body[field], field, 0, 100); if (value?.error || (value != null && !Number.isInteger(value))) errors.push(`${field}_invalid`); else changes[field] = value; continue; }
    if (field === 'features') { const value = normalizeFeatures(body[field]); if (value?.error) errors.push(value.error); else changes[field] = value; }
  }
  if (mode === 'create' && !changes.city) errors.push('city_required');
  if (mode === 'create' && !changes.transaction_type) errors.push('transaction_type_required');
  if (Object.keys(changes).length === 0) errors.push('mutation_fields_required');
  return errors.length ? { ok: false, errors } : { ok: true, mode, id: body.id ? String(body.id) : null, changes };
}

export const propertyMutationFields = MUTABLE_FIELDS;
