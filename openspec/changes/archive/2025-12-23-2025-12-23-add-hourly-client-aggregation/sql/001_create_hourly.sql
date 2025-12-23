-- Create half-hour aggregate table for VibeScore tracker

create table if not exists public.vibescore_tracker_hourly (
  user_id uuid not null,
  device_id uuid not null,
  device_token_id uuid,
  hour_start timestamptz not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.vibescore_tracker_hourly
    add constraint vibescore_tracker_hourly_pkey primary key (user_id, device_id, hour_start);
exception when duplicate_object then null; end $$;

create index if not exists vibescore_tracker_hourly_user_hour_idx
  on public.vibescore_tracker_hourly (user_id, hour_start desc);
create index if not exists vibescore_tracker_hourly_device_token_id_idx
  on public.vibescore_tracker_hourly (device_token_id);

do $$ begin
  alter table public.vibescore_tracker_hourly
    add constraint vibescore_tracker_hourly_device_id_fkey
    foreign key (device_id) references public.vibescore_tracker_devices(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.vibescore_tracker_hourly
    add constraint vibescore_tracker_hourly_device_token_id_fkey
    foreign key (device_token_id) references public.vibescore_tracker_device_tokens(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.vibescore_tracker_hourly enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibescore_tracker_hourly
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_tracker_hourly_select on public.vibescore_tracker_hourly
    for select to public using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_tracker_hourly_insert_by_device_token on public.vibescore_tracker_hourly
    for insert to public
    with check (vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_tracker_hourly_update_by_device_token on public.vibescore_tracker_hourly
    for update to public
    using (vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id))
    with check (vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;
