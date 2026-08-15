export function boundedInteger(name, { defaultValue, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = String(process.env[name] ?? '').trim();
  const parsed = raw === '' ? defaultValue : Number(raw);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export const MAX_BODY_BYTES = boundedInteger('MAX_BODY_BYTES', {
  defaultValue: 256 * 1024,
  min: 1024,
  max: 5 * 1024 * 1024,
});

export const OUTBOUND_TIMEOUT_MS = boundedInteger('OUTBOUND_TIMEOUT_MS', {
  defaultValue: 15_000,
  min: 1_000,
  max: 60_000,
});
