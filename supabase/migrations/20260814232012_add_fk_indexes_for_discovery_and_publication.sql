create index if not exists discovery_entities_run_id_idx on public.discovery_entities (run_id);
create index if not exists discovery_entities_evidence_id_idx on public.discovery_entities (evidence_id);
create index if not exists discovery_evidence_run_id_idx on public.discovery_evidence (run_id);
create index if not exists discovery_evidence_source_id_idx on public.discovery_evidence (source_id);
create index if not exists discovery_jobs_run_id_idx on public.discovery_jobs (run_id);
create index if not exists discovery_runs_source_id_idx on public.discovery_runs (source_id);
create index if not exists publication_jobs_content_variant_id_idx on public.publication_jobs (content_variant_id);
