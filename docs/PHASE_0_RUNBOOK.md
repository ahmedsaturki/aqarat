# Phase 0 Runbook

## Goal

Prove the smallest useful production loop before adding discovery or distribution complexity.

## Acceptance criteria

- An operator can submit a natural-language property description.
- The system records the original input exactly once.
- The parser produces a structured candidate.
- Required fields are validated.
- Duplicate candidates do not create duplicate canonical properties.
- The canonical property is persisted in Postgres.
- Provenance points back to the original intake event.
- A projection job is created for Google Sheets.
- A failure can be retried without duplicating the property.
- Every state transition is auditable.

## Verified so far

- Deterministic Node test suite: **5/5 passing**.
- Production Supabase persistence smoke test: **passed**.
- The test event was marked `processed`.
- One canonical `property` was created with the expected Sadat City fields.
- One `google_sheets_projection` job was queued.
- One `sync_projections` row was created.
- A second call to `commit_intake_event` returned `already_processed`, proving idempotent processing for the event.

## Example input

> شقة 120 متر في المنطقة السابعة بمدينة السادات، الدور الثالث، 3 غرف، 2 حمام، تشطيب جيد، للبيع 2.4 مليون. التواصل واتساب 01xxxxxxxxx

The parser must never invent missing values. Unknown values remain null/unknown.

## Next integration requirements

The following credentials/configuration are intentionally external to the repository and must be supplied as secrets when their adapters are enabled:

- Telegram bot token and allowed operator/chat identifiers.
- Google service-account or OAuth credentials and target spreadsheet ID.
- AI provider/model configuration.
- Any browser-worker session profiles, stored outside Git.

Never commit these secrets.
