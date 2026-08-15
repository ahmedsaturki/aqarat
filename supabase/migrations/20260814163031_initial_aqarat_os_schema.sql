create extension if not exists pgcrypto;

create type public.property_status as enum ('active','inactive','sold','rented','archived','unknown');
create type public.property_transaction_type as enum ('sale','rent','both','unknown');
create type public.person_role as enum ('owner','seller','buyer','broker','agent','developer','tenant','investor','other','unknown');
create type public.source_type as enum ('website','social','classified','telegram','manual','import','other');
create type public.source_record_status as enum ('discovered','parsed','verified','rejected','stale');
create type public.job_status as enum ('queued','running','succeeded','failed','cancelled','needs_review');
create type public.content_status as enum ('draft','review','approved','published','rejected','archived');
create type public.channel_type as enum ('telegram','website','facebook','whatsapp','linkedin','classified','other');
create type public.publication_status as enum ('queued','review','approved','publishing','published','failed','cancelled');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type public.source_type not null,
  base_url text,
  enabled boolean not null default true,
  crawl_policy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  source_url text not null,
  canonical_url text,
  external_id text,
  fetched_at timestamptz not null default now(),
  content_hash text,
  status public.source_record_status not null default 'discovered',
  raw_payload jsonb not null default '{}'::jsonb,
  extracted_payload jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, source_url)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  property_type text,
  transaction_type public.property_transaction_type not null default 'unknown',
  status public.property_status not null default 'unknown',
  title text,
  description text,
  city text not null default 'Sadat City',
  district text,
  neighborhood text,
  address text,
  latitude double precision,
  longitude double precision,
  area_m2 numeric(12,2),
  bedrooms integer,
  bathrooms integer,
  floor text,
  finishing text,
  price numeric(18,2),
  currency text not null default 'EGP',
  features jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  role public.person_role not null default 'unknown',
  organization_name text,
  city text,
  notes text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  contact_type text not null,
  value text not null,
  normalized_value text,
  is_primary boolean not null default false,
  verified boolean not null default false,
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique(contact_type, normalized_value)
);

create table public.property_people (
  property_id uuid not null references public.properties(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  relationship public.person_role not null,
  confidence numeric(5,4) check (confidence between 0 and 1),
  source_record_id uuid references public.source_records(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(property_id, person_id, relationship)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  intent text,
  source text,
  score numeric(5,4) check (score between 0 and 1),
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  audience text,
  channel public.channel_type not null,
  language text not null default 'ar',
  title text,
  body text not null,
  status public.content_status not null default 'draft',
  ai_model text,
  prompt_version text,
  quality_score numeric(5,4) check (quality_score between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  channel public.channel_type not null,
  destination text,
  status public.publication_status not null default 'queued',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_id text,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status public.job_status not null default 'queued',
  priority integer not null default 100,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provenance (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  source_record_id uuid references public.source_records(id) on delete set null,
  field_name text,
  observed_value jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  actor_type text not null default 'system',
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_properties_city on public.properties(city);
create index idx_properties_district on public.properties(district);
create index idx_properties_price on public.properties(price);
create index idx_properties_type on public.properties(property_type);
create index idx_people_city on public.people(city);
create index idx_contacts_person on public.contacts(person_id);
create index idx_property_people_person on public.property_people(person_id);
create index idx_leads_status on public.leads(status);
create index idx_content_status on public.content_items(status);
create index idx_publications_status_scheduled on public.publications(status, scheduled_at);
create index idx_jobs_status_available on public.jobs(status, available_at);
create index idx_provenance_entity on public.provenance(entity_type, entity_id);
create index idx_audit_events_entity on public.audit_events(entity_type, entity_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sources','source_records','properties','people','leads','content_items','publications','jobs'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.sources enable row level security;
alter table public.source_records enable row level security;
alter table public.properties enable row level security;
alter table public.people enable row level security;
alter table public.contacts enable row level security;
alter table public.property_people enable row level security;
alter table public.leads enable row level security;
alter table public.content_items enable row level security;
alter table public.publications enable row level security;
alter table public.jobs enable row level security;
alter table public.provenance enable row level security;
alter table public.audit_events enable row level security;
