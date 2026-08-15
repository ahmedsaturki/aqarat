import { redactForAI as redactMultilingualForAI } from '../security/pii-redactor.mjs';

const INTERNAL_KEYS = new Set([
  'owner', 'owner_name', 'seller', 'seller_name', 'office', 'office_name', 'broker', 'broker_name',
  'contact_name', 'phone', 'phones', 'primary_phone', 'email', 'emails', 'sender_id', 'chat_id',
  'source_event_id', 'external_event_id', 'source_url', 'source_record_id', 'raw_text', 'raw_message',
  'person_id', 'contact_id', 'property_id', 'lead_id', 'lead_score', 'entity_match_score', 'reviewer_id',
]);

function keyOf(key) {
  return String(key).trim().toLowerCase().replace(/\s+/g, '_');
}

export function redactForAI(value) {
  if (typeof value === 'string') return redactMultilingualForAI(value);
  if (Array.isArray(value)) return value.map(redactForAI);
  if (!value || typeof value !== 'object') return value;

  const output = {};
  for (const [key, raw] of Object.entries(value)) {
    if (INTERNAL_KEYS.has(keyOf(key))) continue;
    output[key] = redactForAI(raw);
  }
  return redactMultilingualForAI(output);
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

export function assertAIInputSafe(value) {
  const redacted = redactForAI(value);
  const serialized = JSON.stringify(redacted);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized)) {
    throw new Error('ai_input_contains_email');
  }
  if (/(?:\+?20\D*)?01\D*\d\D*\d{3}\D*\d{4}/.test(serialized) || /[٠-٩]/.test(serialized) && /٠١/.test(serialized)) {
    throw new Error('ai_input_contains_phone');
  }
  return redacted;
}
