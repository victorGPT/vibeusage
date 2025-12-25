-- Create pricing profiles table for VibeScore cost calculation.

create table if not exists public.vibescore_pricing_profiles (
  pricing_id bigserial primary key,
  model text not null,
  source text not null,
  effective_from date not null,
  input_rate_micro_per_million integer not null default 0,
  cached_input_rate_micro_per_million integer not null default 0,
  output_rate_micro_per_million integer not null default 0,
  reasoning_output_rate_micro_per_million integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vibescore_pricing_profiles_effective_idx
  on public.vibescore_pricing_profiles (effective_from desc);

create index if not exists vibescore_pricing_profiles_active_idx
  on public.vibescore_pricing_profiles (active);

create unique index if not exists vibescore_pricing_profiles_unique
  on public.vibescore_pricing_profiles (model, source, effective_from);

alter table public.vibescore_pricing_profiles enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibescore_pricing_profiles
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_pricing_profiles_select on public.vibescore_pricing_profiles
    for select to public using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  grant usage, select on sequence public.vibescore_pricing_profiles_pricing_id_seq to project_admin;
exception when undefined_object then null; end $$;
