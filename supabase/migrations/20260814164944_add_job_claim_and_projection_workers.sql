CREATE OR REPLACE FUNCTION public.claim_job(p_worker text, p_job_type text, p_lease_seconds integer DEFAULT 300)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT j.id
    FROM public.jobs j
    WHERE j.status = 'queued'
      AND j.available_at <= now()
      AND (p_job_type IS NULL OR j.job_type = p_job_type)
      AND j.attempts < j.max_attempts
    ORDER BY j.priority DESC, j.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.jobs j
  SET status = 'running',
      attempts = j.attempts + 1,
      started_at = COALESCE(j.started_at, now()),
      updated_at = now(),
      locked_at = now(),
      locked_by = p_worker,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_expired_jobs()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.jobs
  SET status = 'queued',
      available_at = now(),
      locked_at = NULL,
      locked_by = NULL,
      lease_expires_at = NULL,
      error_message = COALESCE(error_message, 'lease_expired'),
      updated_at = now()
  WHERE status = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
    AND attempts < max_attempts;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;
