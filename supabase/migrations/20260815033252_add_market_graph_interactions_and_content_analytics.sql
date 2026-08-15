create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  interest_type text not null,
  property_type text,
  city text,
  district text,
  min_price numeric,
  max_price numeric,
  min_area_m2 numeric,
  max_area_m2 numeric,
  intent_score numeric not null default 0.0 check (intent_score between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','stale','closed')),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  channel text not null,
  interaction_type text not null,
  direction text not null check (direction in ('inbound','outbound')),
  content_ref uuid,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.content_performance (
  id uuid primary key default gen_random_uuid(),
  content_variant_id uuid not null references public.content_variants(id) on delete cascade,
  channel text not null,
  impressions integer not null default 0 check (impressions >= 0),
  views integer not null default 0 check (views >= 0),
  replies integer not null default 0 check (replies >= 0),
  qualified_inquiries integer not null default 0 check (qualified_inquiries >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  last_observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_variant_id, channel)
);

create table if not exists public.marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hypothesis text not null,
  audience text,
  funnel_stage text,
  control_variant_id uuid references public.content_variants(id) on delete set null,
  treatment_variant_id uuid references public.content_variants(id) on delete set null,
  primary_metric text,
  status text not null default 'draft' check (status in ('draft','running','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interests_person_idx on public.interests(person_id);
create index if not exists interests_city_type_idx on public.interests(city, property_type);
create index if not exists interests_intent_idx on public.interests(intent_score desc);
create index if not exists interactions_person_time_idx on public.interactions(person_id, observed_at desc);
create index if not exists interactions_property_time_idx on public.interactions(property_id, observed_at desc);
create index if not exists interactions_channel_idx on public.interactions(channel, interaction_type);
create index if not exists content_performance_channel_idx on public.content_performance(channel, last_observed_at desc);

alter table public.interests enable row level security;
alter table public.interactions enable row level security;
alter table public.content_performance enable row level security;
alter table public.marketing_experiments enable row level security;

create policy deny_direct_interests on public.interests for all to anon, authenticated using (false) with check (false);
create policy deny_direct_interactions on public.interactions for all to anon, authenticated using (false) with check (false);
create policy deny_direct_content_performance on public.content_performance for all to anon, authenticated using (false) with check (false);
create policy deny_direct_marketing_experiments on public.marketing_experiments for all to anon, authenticated using (false) with check (false);
