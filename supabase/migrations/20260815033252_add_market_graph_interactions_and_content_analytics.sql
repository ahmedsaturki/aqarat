-- Reproducibility mirror for production migration:
-- 20260815033252_add_market_graph_interactions_and_content_analytics
-- This file records the intended DDL for the market graph layer introduced in production.
-- It is idempotent so it can be inspected/replayed safely in a fresh environment.

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
  intent_score numeric not null default 0.0,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active',
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
  direction text not null,
  content_ref uuid references public.content_variants(id) on delete set null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.content_performance (
  id uuid primary key default gen_random_uuid(),
  content_variant_id uuid not null references public.content_variants(id) on delete cascade,
  channel text not null,
  impressions integer not null default 0,
  views integer not null default 0,
  replies integer not null default 0,
  qualified_inquiries integer not null default 0,
  conversions integer not null default 0,
  last_observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hypothesis text not null,
  audience text,
  funnel_stage text,
  control_variant_id uuid references public.content_variants(id) on delete set null,
  treatment_variant_id uuid references public.content_variants(id) on delete set null,
  primary_metric text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interests_person_status_idx on public.interests(person_id, status);
create index if not exists interests_market_filter_idx on public.interests(city, property_type, min_price, max_price);
create index if not exists interactions_person_observed_idx on public.interactions(person_id, observed_at desc);
create index if not exists interactions_property_observed_idx on public.interactions(property_id, observed_at desc);
create index if not exists content_performance_variant_channel_idx on public.content_performance(content_variant_id, channel);
create index if not exists marketing_experiments_status_idx on public.marketing_experiments(status);

alter table public.interests enable row level security;
alter table public.interactions enable row level security;
alter table public.content_performance enable row level security;
alter table public.marketing_experiments enable row level security;

create policy if not exists deny_direct_interests on public.interests for all to anon, authenticated using (false) with check (false);
create policy if not exists deny_direct_interactions on public.interactions for all to anon, authenticated using (false) with check (false);
create policy if not exists deny_direct_content_performance on public.content_performance for all to anon, authenticated using (false) with check (false);
create policy if not exists deny_direct_marketing_experiments on public.marketing_experiments for all to anon, authenticated using (false) with check (false);
