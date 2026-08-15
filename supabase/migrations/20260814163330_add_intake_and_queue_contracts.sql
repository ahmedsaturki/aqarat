create table if not exists intake_events (id uuid primary key default gen_random_uuid(), channel text not null, external_event_id text, sender_id text, chat_id text, raw_text text not null, parsed_payload jsonb, status text not null default 'received', error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists intake_events_channel_external_uidx on intake_events(channel, external_event_id) where external_event_id is not null;
create index if not exists intake_events_status_created_idx on intake_events(status, created_at);
create index if not exists jobs_status_available_idx on jobs(status, available_at, priority desc, created_at);
create table if not exists sync_projections (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, projection_type text not null, external_key text, status text not null default 'pending', last_error text, last_synced_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists sync_projections_entity_projection_uidx on sync_projections(entity_type, entity_id, projection_type);
create index if not exists sync_projections_status_idx on sync_projections(status);
