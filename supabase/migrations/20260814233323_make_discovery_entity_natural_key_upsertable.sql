drop index if exists public.discovery_entities_external_key_uq;
alter table public.discovery_entities add constraint discovery_entities_external_key_uq unique (entity_type, external_key);
