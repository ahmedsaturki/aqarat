create unique index if not exists jobs_idempotency_key_uq on public.jobs(idempotency_key) where idempotency_key is not null;
