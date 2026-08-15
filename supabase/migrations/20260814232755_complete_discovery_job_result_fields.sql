alter table public.discovery_jobs add column if not exists result jsonb not null default '{}'::jsonb;
alter table public.discovery_jobs add column if not exists finished_at timestamptz;
create index if not exists discovery_jobs_finished_at_idx on public.discovery_jobs (finished_at desc) where finished_at is not null;
