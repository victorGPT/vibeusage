-- Create project registry + project usage hourly tables.

create table if not exists public.vibeusage_projects (
  project_id bigint generated always as identity primary key,
  user_id uuid not null,
  device_id uuid not null,
  device_token_id uuid,
  project_key text not null,
  project_ref text not null,
  source text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vibeusage_projects_user_key_uniq
  on public.vibeusage_projects (user_id, project_key);

create index if not exists vibeusage_projects_user_last_seen_idx
  on public.vibeusage_projects (user_id, last_seen_at desc);

create index if not exists vibeusage_projects_user_source_idx
  on public.vibeusage_projects (user_id, source);

create table if not exists public.vibeusage_project_usage_hourly (
  usage_id bigint generated always as identity primary key,
  user_id uuid not null,
  device_id uuid not null,
  device_token_id uuid,
  project_key text not null,
  project_ref text not null,
  source text not null,
  hour_start timestamptz not null,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  billable_total_tokens bigint not null default 0,
  billable_rule_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create unique index if not exists vibeusage_project_usage_hourly_uniq
  on public.vibeusage_project_usage_hourly (user_id, project_key, hour_start, source);

create index if not exists vibeusage_project_usage_hourly_user_project_idx
  on public.vibeusage_project_usage_hourly (user_id, project_key, hour_start desc);

create index if not exists vibeusage_project_usage_hourly_user_source_idx
  on public.vibeusage_project_usage_hourly (user_id, source, hour_start desc);

create index if not exists vibeusage_project_usage_hourly_user_last_seen_idx
  on public.vibeusage_project_usage_hourly (user_id, hour_start desc);

do $$ begin
  alter table public.vibeusage_projects
    add constraint vibeusage_projects_device_id_fkey
    foreign key (device_id) references public.vibeusage_tracker_devices(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vibeusage_projects
    add column updated_at timestamptz not null default now();
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.vibeusage_projects
    add constraint vibeusage_projects_device_token_id_fkey
    foreign key (device_token_id) references public.vibeusage_tracker_device_tokens(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vibeusage_project_usage_hourly
    add constraint vibeusage_project_usage_hourly_device_id_fkey
    foreign key (device_id) references public.vibeusage_tracker_devices(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vibeusage_project_usage_hourly
    add constraint vibeusage_project_usage_hourly_device_token_id_fkey
    foreign key (device_token_id) references public.vibeusage_tracker_device_tokens(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.vibeusage_projects enable row level security;
alter table public.vibeusage_project_usage_hourly enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibeusage_projects
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy project_admin_usage_policy on public.vibeusage_project_usage_hourly
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_projects_select on public.vibeusage_projects
    for select to public using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_project_usage_hourly_select on public.vibeusage_project_usage_hourly
    for select to public using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_projects_insert_by_device_token on public.vibeusage_projects
    for insert to public
    with check (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_projects_update_by_device_token on public.vibeusage_projects
    for update to public
    using (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id))
    with check (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_project_usage_hourly_insert_by_device_token on public.vibeusage_project_usage_hourly
    for insert to public
    with check (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibeusage_project_usage_hourly_update_by_device_token on public.vibeusage_project_usage_hourly
    for update to public
    using (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id))
    with check (public.vibeusage_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;

do $$ begin
  grant usage, select on sequence public.vibeusage_projects_project_id_seq to project_admin;
exception when undefined_object then null; end $$;

do $$ begin
  grant usage, select on sequence public.vibeusage_project_usage_hourly_usage_id_seq to project_admin;
exception when undefined_object then null; end $$;
