# Aqarat OS Architecture Contract

## System boundaries

```text
Telegram / operator UI
        |
        v
   Intake API
        |
        v
 Extraction + normalization
        |
        +----> validation / duplicate detection
        |
        v
 Supabase/Postgres (source of truth)
        |
        +----> Google Sheets projection
        +----> discovery jobs
        +----> content jobs
        +----> publication queue
```

## Core principles

### 1. Database first
Postgres owns entities and state. Workers must be idempotent and safe to retry.

### 2. Evidence first
External facts are observations. A normalized property/person field is not considered trustworthy merely because an AI model produced it. Preserve source record, observed value and confidence.

### 3. Deterministic before AI
Use ordinary parsing, schemas and validation before invoking an LLM. AI is used where ambiguity or semantic reasoning exists.

### 4. Browser automation is an execution capability
Playwright/Crawlee are the deterministic baseline. An AI browser agent may be used as a constrained fallback for a page that cannot be handled by a deterministic adapter. It must still return structured evidence to the same database contract.

### 5. Distribution is a queue
Generation and publication are separate. A publication job can be reviewed, approved, retried, cancelled or marked blocked without changing the underlying property.

### 6. External platforms
Do not depend on unofficial automation to defeat platform controls. Support owned channels and human-assisted workflows first. Platform-specific adapters are isolated so one platform failure cannot stop the system.

## Entity model

- `properties`: canonical real-estate objects.
- `people`: owners, agents, buyers, sellers, developers and other business contacts.
- `contacts`: phone/email/social/contact identifiers with verification and confidence.
- `property_people`: relationships between properties and people.
- `leads`: commercial intent and qualification state.
- `sources`: crawl/discovery source definitions and policies.
- `source_records`: immutable-ish observations from sources.
- `provenance`: field-level evidence linking canonical facts to observations.
- `content_items`: generated, reviewed content variants.
- `publications`: destination-specific publication state.
- `jobs`: durable worker queue.
- `intake_events`: inbound natural-language events and processing state.
- `sync_projections`: idempotent projection state for systems such as Sheets.
- `audit_events`: operational audit trail.

## Failure model

Every asynchronous operation must have:

- deterministic idempotency key;
- status;
- attempt count;
- retry/backoff policy;
- terminal failure state;
- error message;
- audit event;
- enough payload/evidence to reproduce the failure.

## Build order

1. Intake contract.
2. Entity extraction and validation.
3. Deduplication and upsert.
4. Google Sheets projection.
5. Discovery adapters.
6. Matching and lead scoring.
7. Content generation/review.
8. Publication queue and human-assisted adapters.
9. Monitoring and operational dashboard.
