const INTERNAL_KEYS = new Set([
  'owner', 'owner_name', 'seller', 'seller_name', 'office', 'office_name', 'broker', 'broker_name',
  'contact_name', 'phone', 'phones', 'primary_phone', 'email', 'emails', 'sender_id', 'chat_id',
  'source_event_id', 'external_event_id', 'source_url', 'source_record_id', 'raw_text', 'person_id',
  'contact_id', 'property_id', 'lead_id', 'lead_score', 'entity_match_score',
]);

function keyOf(key) {
  return String(key).trim().toLowerCase().replace(/\s+/g, '_');
}

function redactText(text) {
  return String(text ?? '')
    .replace(/(?:\+?20\s*)?01\d[\s-]?\d{3}[\s-]?\d{4}/g, '[PHONE_REDACTED]')
    .replace(/(?:\b|^)[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}(?:\b|$)/g, '[EMAIL_REDACTED]');
}

export function redactForAI(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactForAI);
  if (!value || typeof value !== 'object') return value;

  const output = {};
  for (const [key, raw] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(keyOf(key))) continue;
    output[key] = redactForAI(raw);
  }
  return output;
}

export function redactEvidenceForAI(evidence = {}) {
  return redactForAI({
    title: evidence?.extracted_payload?.title || null,
    description: evidence?.extracted_payload?.description || null,
    text: evidence?.extracted_payload?.text || null,
    json_ld: evidence?.extracted_payload?.json_ld || [],
    canonical_url: null,
  });
}

export function redactPropertyForAI(property = {}) {
  return redactForAI(property);
}
