# Audit P0/P1 Remediation

## Source audit

External audit dated 2026-08-15 identified four priority gaps before broad production expansion:

1. Failing test suite on `main`.
2. Public Telegram status endpoint with side effects and Host-derived webhook URL.
3. Supabase migration history not fully reproducible from Git.
4. Gemini calls without an explicit PII-redaction boundary and without retry/backoff.

## Remediated in code

### Telegram status
- `GET /api/telegram/status` now requires `X-Aqarat-Telegram-Admin-Secret`.
- Webhook configuration uses `PUBLIC_BASE_URL`, never the incoming `Host` header.
- Public response no longer exposes bot identity, webhook URL, or Telegram error payloads.
- Missing admin secret or production URL fails closed.

### Preview isolation
- Telegram intake, generic intake, and Sheets writes are disabled outside Vercel Production.
- Preview deployments therefore cannot write to production Telegram, Supabase intake, or Google Sheets through these routes.

### Gemini privacy and reliability
- Added `src/ai/privacy.mjs` as the explicit AI input boundary.
- Phone numbers, emails, owner/seller/office identity, source identifiers and internal IDs are removed before AI calls.
- Evidence URLs are excluded from AI prompts.
- Agent system prompts explicitly treat external text as untrusted data and prohibit following embedded instructions.
- Gemini requests have bounded timeouts, retries for transient errors, exponential backoff and a maximum attempt count.

### Tests
- Added regression coverage for the AI PII boundary.
- Existing AI runtime tests remain fail-safe when no provider key is configured.

## Not falsely marked complete

The audit reported 11 failing tests on the inspected `main`. The repository integration available in this environment does not execute the full GitHub Actions test command locally, so those 11 behavioral failures are not considered resolved solely by code changes. CI must be green before broad production expansion.

The audit also reported that the production database contains 24 migrations while Git contains only a historical migration manifest/README. The migration history is therefore **documented but not fully reconstructed**. A safe export of all historical SQL must be obtained from the database tooling before claiming full rebuild reproducibility.

## Production gate

Broad discovery and publishing expansion remains gated on:

- `npm test` = 0 failures.
- Production Telegram status endpoint = 401 without admin secret.
- Fixed `PUBLIC_BASE_URL` verified in production.
- AI PII redaction tests passing.
- Preview external integrations confirmed disabled.
- Migration export/rebuild test completed.

Until these gates pass, continue controlled discovery only and do not widen external publishing.
