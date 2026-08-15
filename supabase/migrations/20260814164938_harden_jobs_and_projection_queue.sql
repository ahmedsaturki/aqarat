ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_key_uq
  ON public.jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_claim_idx
  ON public.jobs (status, available_at, priority DESC, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS jobs_lease_idx
  ON public.jobs (status, lease_expires_at)
  WHERE status = 'running';

CREATE UNIQUE INDEX IF NOT EXISTS sync_projections_entity_projection_uq
  ON public.sync_projections (entity_type, entity_id, projection_type);
