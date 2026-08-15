const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_CANDIDATE_RE = /(?:\+?\s*20[\s().-]*)?(?:[٠-٩0-9][\s().-]*){9,14}/gu;

function toAsciiDigits(value) {
  return String(value ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeEgyptianPhone(value) {
  const ascii = toAsciiDigits(value).replace(/\D/g, '');
  if (!ascii) return null;
  if (ascii.startsWith('0020')) return `+${ascii.slice(2)}`;
  if (ascii.startsWith('20') && ascii.length >= 12) return `+${ascii}`;
  if (ascii.startsWith('01') && ascii.length === 11) return `+20${ascii.slice(1)}`;
  if (ascii.startsWith('1') && ascii.length === 10) return `+20${ascii}`;
  return null;
}

export function redactPhoneNumbers(text) {
  return String(text ?? '').replace(PHONE_CANDIDATE_RE, (candidate) => {
    const normalized = normalizeEgyptianPhone(candidate);
    return normalized ? '[PHONE_REDACTED]' : candidate;
  });
}

export function redactEmails(text) {
  return String(text ?? '').replace(EMAIL_RE, '[EMAIL_REDACTED]');
}

export function redactIdentityFields(value, keys = []) {
  if (Array.isArray(value)) return value.map((item) => redactIdentityFields(item, keys));
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set([
    'owner','owner_name','seller','seller_name','broker','broker_name','office','office_name',
    'email','emails','phone','phones','primary_phone','sender_id','chat_id','person_id','contact_id',
    'source_event_id','external_event_id','source_url','raw_text','raw_message','lead_id',...keys,
  ]);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (blocked.has(String(key).toLowerCase())) continue;
    out[key] = redactIdentityFields(item, keys);
  }
  return out;
}

export function redactForAI(input) {
  if (typeof input === 'string') return redactEmails(redactPhoneNumbers(input));
  const stripped = redactIdentityFields(input);
  if (typeof stripped === 'string') return redactForAI(stripped);
  if (!stripped || typeof stripped !== 'object') return stripped;
  const walk = (value) => {
    if (typeof value === 'string') return redactEmails(redactPhoneNumbers(value));
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, walk(v)]));
    return value;
  };
  return walk(stripped);
}
