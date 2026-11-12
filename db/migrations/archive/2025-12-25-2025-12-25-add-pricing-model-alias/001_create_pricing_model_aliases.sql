-- Create pricing model alias table for usage->pricing mapping.

create table if not exists public.vibescore_pricing_model_aliases (
  alias_id bigserial primary key,
  usage_model text not null,
  pricing_model text not null,
  pricing_source text not null,
  effective_from date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vibescore_pricing_model_aliases_usage_idx
  on public.vibescore_pricing_model_aliases (usage_model);

create index if not exists vibescore_pricing_model_aliases_source_idx
  on public.vibescore_pricing_model_aliases (pricing_source);

create index if not exists vibescore_pricing_model_aliases_active_idx
  on public.vibescore_pricing_model_aliases (active);

create unique index if not exists vibescore_pricing_model_aliases_unique
  on public.vibescore_pricing_model_aliases (usage_model, pricing_source, effective_from);

alter table public.vibescore_pricing_model_aliases enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibescore_pricing_model_aliases
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_pricing_model_aliases_select on public.vibescore_pricing_model_aliases
    for select to public using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  grant usage, select on sequence public.vibescore_pricing_model_aliases_alias_id_seq to project_admin;
exception when undefined_object then null; end $$;
