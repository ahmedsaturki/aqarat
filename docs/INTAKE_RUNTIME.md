# Aqarat Intake Runtime

The runtime is intentionally small and independent of n8n.

## Flow

```text
Telegram webhook / provider-neutral POST
        |
        v
Node HTTP runtime
        |
        +--> deterministic Telegram adapter (when applicable)
        |
        v
Supabase service-role transport
        |
        +--> intake_events (idempotent external event)
        |
        +--> commit_intake_event RPC
        |
        v
properties / people / contacts / property_people
        |
        +--> google_sheets_projection job
        +--> audit_events
```

## Endpoints

- `GET /healthz`
- `POST /intake` for a provider-neutral intake contract
- `POST /telegram/update` for Telegram Bot API updates

## Security

- The service-role key exists only on the server.
- Telegram webhook requests can require `X-Telegram-Bot-Api-Secret-Token`.
- Request bodies have a configurable size limit.
- Public/authenticated roles cannot execute the intake/job RPCs in production.
- PostgreSQL remains the source of truth; the HTTP service contains no business-state cache.

## Why this replaces n8n for the core intake path

The intake path has a short, deterministic sequence and benefits from a small process: fewer moving parts, fewer workflow-runtime failure modes, simpler deployment and lower idle resource use. n8n can still be added later as an operator-facing orchestration layer if a workflow genuinely benefits from it; it is not required for the core data path.

## Required secrets

Copy `.env.example` into the deployment environment and supply:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_WEBHOOK_SECRET`

No secret belongs in Git.

## Not enabled yet

The runtime is code-complete at the transport boundary but is intentionally not exposed to the public internet until the Telegram bot identity, allowed operator/chat IDs, TLS/reverse proxy and deployment environment are configured and tested.
