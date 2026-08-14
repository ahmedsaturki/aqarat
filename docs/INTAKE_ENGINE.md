# Intake Engine

The Intake Engine is the first executable vertical of Aqarat OS.

## Contract

`natural language -> deterministic parse -> validation -> intake event -> canonical property -> contacts -> Sheets projection job -> audit`

The original message is retained verbatim in `intake_events.raw_text`.

## Deterministic-first parsing

The first parser is intentionally dependency-light and runs before any LLM. It currently recognizes common Arabic/English forms for:

- Sadat City aliases
- district aliases
- apartment/villa/land/office/shop/warehouse/building types
- sale/rent intent
- area
- bedrooms and bathrooms
- floor
- finishing
- EGP price values including million/billion/thousand forms
- Egyptian phone numbers

Unknown values remain `null`/`unknown`. The parser never fills missing facts from guesses.

## Validation

A candidate is accepted only when the city resolves to Sadat City and numeric fields that are present are valid. Missing optional information generates warnings, not fabricated values.

## Persistence contract

`commit_intake_event(intake_event_id)` performs the transactional database side:

1. Locks the intake event.
2. Rejects invalid candidates and writes an audit event.
3. Finds an equivalent canonical property using deterministic fields.
4. Creates or updates the canonical property.
5. Resolves phone contacts to a person and links the person to the property.
6. Queues a `google_sheets_projection` job.
7. Creates an idempotent `sync_projections` row.
8. Writes an `intake_committed` audit event.
9. Marks the intake event `processed`.

Calling the function again for a processed event returns `already_processed` and does not duplicate the downstream work.

## Tested

The Node test suite covers Arabic extraction, city rejection, non-invention of missing fields, intake envelopes and stable dedup keys. The SQL persistence path was also exercised directly against the production Supabase project with an Arabic Sadat City property example; the event reached `processed`, a canonical property was created, a Sheets projection job was queued, and a second commit returned `already_processed`.

## Next step

The next layer is the adapter boundary. Telegram should translate each incoming update into the same `intake_events` contract. Google Sheets should consume only `google_sheets_projection` jobs. AI can later enrich ambiguous candidates, but it must not bypass this validation and provenance path.
