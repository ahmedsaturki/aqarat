# Discovery Engine — V1 Boundary

The Discovery Engine is the second executable vertical after Intake.

## Pipeline

`source registry -> discovery job -> public fetch -> evidence extraction -> source_record -> deterministic normalization -> provenance -> canonical upsert`

## V1 rules

- Only public, policy-permitted URLs are fetched.
- No credentials in URLs, authentication bypass, CAPTCHA evasion, or private-data collection.
- HTTP fetching is bounded by timeout and response-size limits.
- Raw source material remains evidence; it is never treated as canonical truth by itself.
- JSON-LD/OpenGraph/title/description are extracted deterministically before any AI enrichment.
- Browser automation is a later adapter for sources that genuinely require rendering; it must emit the same source-record contract.
- AI browser agents are constrained fallbacks, not the primary crawler.

## Source record contract

Every discovery result should preserve:

- `source_url`
- `canonical_url`
- `fetched_at`
- fetch status
- raw/evidence payload or a bounded representation
- extracted structured payload
- content hash
- confidence

The existing `sources`, `source_records`, and `provenance` tables are the persistence boundary. Durable execution uses the existing `jobs` table with deterministic idempotency keys.

## Adapter order

1. Direct HTTP fetch.
2. Deterministic HTML/JSON-LD/OpenGraph extraction.
3. Playwright/Crawlee adapter for permitted rendered pages.
4. AI browser fallback only when deterministic automation cannot reliably navigate the page.

## Initial Sadat City discovery scope

Start with a small, explicitly configured source registry and expand only after each adapter passes extraction, deduplication, provenance, retry and policy tests. The goal is coverage, not uncontrolled crawling.
