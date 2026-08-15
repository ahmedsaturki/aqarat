# Aqarat OS — Release Gates

A release is Production-verified only when the same Git SHA is proven through all gates.

## Required sequence

1. `npm test` / GitHub Actions test workflow is green for the release SHA.
2. Supabase schema is represented by the authoritative migration set and the release declares the migration head.
3. Production Vercel deployment reports `READY` and exposes the exact Git SHA.
4. Smoke checks pass on the deployed release:
   - `GET /healthz` or equivalent minimal health route
   - `GET /api/telegram/status` without the admin secret is denied
   - `POST /intake` without the intake secret is denied
   - preview deployments cannot invoke production intake/Telegram side effects
   - public config contains only approved brand/contact values
   - dashboard requires operator authentication
5. First worker cycle is observed after deployment; workers do not run merely because an unverified commit was pushed.
6. The release record is committed with SHA, CI run, deployment ID, smoke-test evidence, and migration version.

## Production freeze rules

- Do not expand Discovery sources while a release/production SHA mismatch exists.
- Do not enable broad external publishing while P0/P1 governance gates are open.
- Do not enable a Discovery source without permission evidence or a documented policy exception.
- Do not send raw intake, owner identity, contact identifiers, source metadata, or internal prices to public marketing surfaces.
- Do not send unredacted PII to Gemini.

## Rollback rule

Rollback uses a previously verified Production SHA. A rollback must preserve database compatibility with the current migration head. Do not roll back application code across an incompatible database migration.
