const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_BASE_URL = String(process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');

function assertSchemaObject(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    throw new Error('ai_schema_must_be_object');
  }
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => part?.text || '').join('');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/```json\s*([\s\S]*?)\s*```/i);
    if (match) return JSON.parse(match[1]);
    throw new Error('ai_invalid_json_response');
  }
}

export function aiAvailable() {
  return Boolean(GEMINI_API_KEY);
}

export async function runStructuredAgent({
  agent,
  system,
  input,
  schema,
  temperature = 0.1,
  timeoutMs = 30000,
} = {}) {
  assertSchemaObject(schema);

  if (!GEMINI_API_KEY) {
    return {
      enabled: false,
      agent,
      model: null,
      output: null,
      reason: 'GEMINI_API_KEY_not_configured',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: String(system || '') }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input ?? {}) }] }],
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(`ai_http_${response.status}`);
      error.body = payload;
      throw error;
    }

    const output = safeJsonParse(extractText(payload));
    return {
      enabled: true,
      agent,
      model: GEMINI_MODEL,
      output,
      usage: payload?.usageMetadata || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const AI_AGENT_ROLES = Object.freeze({
  DISCOVERY_TRIAGE: 'discovery-triage',
  PROPERTY_EXTRACTION: 'property-extraction',
  INTEREST_INTELLIGENCE: 'interest-intelligence',
  SALES_MARKETING: 'sales-marketing',
});
