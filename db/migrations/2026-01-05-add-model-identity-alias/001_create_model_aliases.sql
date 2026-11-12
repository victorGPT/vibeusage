-- Create model identity alias table for usage->canonical mapping.

create table if not exists public.vibescore_model_aliases (
  alias_id bigserial primary key,
  usage_model text not null,
  canonical_model text not null,
  display_name text,
  effective_from timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vibescore_model_aliases_usage_effective_idx
  on public.vibescore_model_aliases (usage_model, effective_from desc);

create index if not exists vibescore_model_aliases_canonical_idx
  on public.vibescore_model_aliases (canonical_model);

create index if not exists vibescore_model_aliases_active_idx
  on public.vibescore_model_aliases (active);

alter table public.vibescore_model_aliases enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibescore_model_aliases
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_model_aliases_select on public.vibescore_model_aliases
    for select to public using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  grant usage, select on sequence public.vibescore_model_aliases_alias_id_seq to project_admin;
exception when undefined_object then null; end $$;
