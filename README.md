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
