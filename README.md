# Aqarat OS

Aqarat OS is a Sadat City real-estate intelligence and operations platform.

## Mission

Build a reliable, auditable pipeline that can:

1. Capture property information from natural-language input.
2. Normalize, validate, deduplicate and store it in Supabase/Postgres.
3. Discover public, policy-permitted property and market information from the web.
4. Maintain people, contacts, leads and provenance separately from property records.
5. Generate channel-specific content with AI, followed by quality/policy review.
6. Prepare distribution jobs for Telegram, owned groups/channels and human-assisted external publishing.
7. Keep PostgreSQL as the source of truth and treat Google Sheets as an operational projection, not the database.

## Architecture

- **Supabase/Postgres:** source of truth, provenance, jobs, audit.
- **Application workers:** deterministic parsing, normalization, crawling and publishing adapters.
- **AI:** extraction, enrichment, matching, content generation and review; never the authoritative datastore.
- **Browser automation:** Playwright/Crawlee first; AI browser agents are controlled fallbacks for pages that require reasoning.
- **Telegram:** primary human-friendly intake/control surface.
- **Google Sheets:** optional projection for operational use.

## Operating policy

- Public and policy-permitted data only.
- No credential theft, access-control bypassing, CAPTCHA evasion, or collection of private/non-public information.
- External-platform publishing is queued and human-assisted unless an officially permitted integration is available.
- Important facts retain source/provenance and confidence.

## Phase 0

The first production vertical is:

`Telegram/natural language -> intake -> extraction -> validation -> deduplication -> Postgres -> Sheets projection`

Only after this path passes end-to-end tests do we activate discovery and distribution workers.

## Runtime safety and release operations

The production API is served through a single allowlisted catch-all function to remain compatible with the Vercel Hobby function limit. Every response includes restrictive security headers, a no-store cache policy, an explicit content length, and a correlation identifier that is shared with delegated handlers and structured error logs. Unknown routes fail closed with a generic JSON response; internal exception details and upstream response bodies are never returned to callers.

The catch-all router emits structured `api_request_started`, `api_request_completed`, and `api_route_error` records containing only the method, allowlisted route, status, duration, bounded response size, and correlation identifier. Responses also expose `x-response-time-ms` and `server-timing` for safe external latency measurement; request bodies, query values, cookies, authorization headers, and upstream payloads are not logged. Untrusted exception messages pass through `safeErrorMessage`, which redacts query credentials, bearer tokens, passwords, and email addresses and bounds provider text before it reaches structured logs.

Outbound requests use the shared `timedFetch` wrapper and `OUTBOUND_TIMEOUT_MS`, bounded to 1–60 seconds with a 15-second default. The audited exceptions are deliberate: public discovery uses a specialized adapter because it must combine DNS/SSRF validation, redirect re-validation, streaming byte limits, and content-type parsing; deep health and release/performance probes use bounded contract-specific probes. Incoming request bodies use `MAX_BODY_BYTES`, bounded to 1 KiB–5 MiB with a 256 KiB default. Invalid or non-numeric environment values fall back to safe defaults rather than disabling protection. Deterministic intake rejects non-text, empty, and over-4,000-character messages; impossible numeric and contact values are rejected, while unusually large but technically valid area, price, or room values are retained with explicit validation warnings for operator review.

The dashboard data endpoint accepts bounded `limit` and `offset` parameters (defaults 50, maximum 100, maximum offset 1,000,000) and returns per-view `pagination` metadata with `returned`, `has_more`, and `next_offset`. Dashboard errors return a generic retryable code plus the request correlation identifier; the operator UI renders a localized retry message instead of exposing upstream details. The private operator surface also uses semantic navigation, a skip link, accessible labels and live status regions, visible keyboard focus, reduced-motion support, and bounded login feedback that clears the password field after successful authentication. Dashboard Supabase reads use the shared outbound timeout helper rather than unbounded fetches. The repository quality gate is `npm run check`, which runs the full Node test suite and syntax validation for all application, API, script, and test modules. Production verification runs this gate before checking the public release contract and authenticated deep health. Gemini deep health uses a quota-safe model metadata probe by default: it validates the API key, model availability, and `generateContent` support without consuming generation quota. Set `GEMINI_HEALTH_PROBE=generation` only for an explicit diagnostic that needs to exercise generation; provider failures remain explicit failures and are never converted into success. Scheduled worker workflows use least-privilege GitHub permissions and single-flight concurrency controls to avoid overlapping queue processors.

## Database migrations

Database changes are kept in `supabase/migrations/` and must be reviewed against the live Supabase advisor output before application. The duplicate discovery-policy cleanup migration removes only redundant role-specific deny policies; the shared deny policy remains active for anonymous and authenticated roles, while service-role application access is not targeted. After applying a migration, rerun both security and performance advisors and execute the public-role access smoke tests.

## Required production configuration

The production runtime requires the values listed in `.env.example`, including `PUBLIC_BASE_URL` for Telegram webhook health, the provider credentials used by Gemini and Telegram, the Supabase service-role credential for backend workers, and the dedicated workflow secrets used by GitHub Actions. Secret values must be entered through the deployment or secret manager rather than committed to the repository or pasted into issue comments.
