alter table public.sync_projections add column if not exists canonical_key text;
create index if not exists sync_projections_canonical_key_idx on public.sync_projections(canonical_key);
update public.sync_projections sp
set canonical_key = p.canonical_key,
    updated_at = now()
from public.properties p
where sp.entity_type='property'
  and sp.entity_id=p.id
  and sp.projection_type='google_sheets';
