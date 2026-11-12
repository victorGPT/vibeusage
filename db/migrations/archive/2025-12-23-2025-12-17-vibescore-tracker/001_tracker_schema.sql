-- VibeScore Tracker schema (Codex CLI token usage)
-- Change: 2025-12-17-vibescore-tracker

-- NOTE:
-- - This schema stores only token counts and minimal metadata.
-- - It MUST NOT store prompt/response content.

-- Devices (one user can have multiple machines)
create table if not exists public.vibescore_tracker_devices (
  id uuid primary key,
  user_id uuid not null,
  device_name text not null,
  platform text null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  revoked_at timestamptz null
);

create index if not exists vibescore_tracker_devices_user_id_idx
  on public.vibescore_tracker_devices (user_id);

alter table public.vibescore_tracker_devices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_devices' and policyname = 'project_admin_policy'
  ) then
    create policy project_admin_policy on public.vibescore_tracker_devices
      for all to project_admin
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_devices' and policyname = 'vibescore_tracker_devices_select'
  ) then
    create policy vibescore_tracker_devices_select on public.vibescore_tracker_devices
      for select to public
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_devices' and policyname = 'vibescore_tracker_devices_insert'
  ) then
    create policy vibescore_tracker_devices_insert on public.vibescore_tracker_devices
      for insert to public
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_devices' and policyname = 'vibescore_tracker_devices_update'
  ) then
    create policy vibescore_tracker_devices_update on public.vibescore_tracker_devices
      for update to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Device tokens (hashed; plaintext is returned only once at issuance)
create table if not exists public.vibescore_tracker_device_tokens (
  id uuid primary key,
  user_id uuid not null,
  device_id uuid not null references public.vibescore_tracker_devices (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked_at timestamptz null
);

create unique index if not exists vibescore_tracker_device_tokens_token_hash_uniq
  on public.vibescore_tracker_device_tokens (token_hash);

create index if not exists vibescore_tracker_device_tokens_user_id_idx
  on public.vibescore_tracker_device_tokens (user_id);

alter table public.vibescore_tracker_device_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_device_tokens' and policyname = 'project_admin_policy'
  ) then
    create policy project_admin_policy on public.vibescore_tracker_device_tokens
      for all to project_admin
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_device_tokens' and policyname = 'vibescore_tracker_device_tokens_select'
  ) then
    create policy vibescore_tracker_device_tokens_select on public.vibescore_tracker_device_tokens
      for select to public
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_device_tokens' and policyname = 'vibescore_tracker_device_tokens_update'
  ) then
    create policy vibescore_tracker_device_tokens_update on public.vibescore_tracker_device_tokens
      for update to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Raw token events (append-only; idempotent by (user_id, event_id))
create table if not exists public.vibescore_tracker_events (
  user_id uuid not null,
  device_id uuid null references public.vibescore_tracker_devices (id) on delete set null,
  event_id text not null,
  token_timestamp timestamptz not null,
  model text null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  meta jsonb null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists vibescore_tracker_events_user_ts_idx
  on public.vibescore_tracker_events (user_id, token_timestamp desc);

alter table public.vibescore_tracker_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_events' and policyname = 'project_admin_policy'
  ) then
    create policy project_admin_policy on public.vibescore_tracker_events
      for all to project_admin
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vibescore_tracker_events' and policyname = 'vibescore_tracker_events_select'
  ) then
    create policy vibescore_tracker_events_select on public.vibescore_tracker_events
      for select to public
      using (auth.uid() = user_id);
  end if;
end$$;

-- Daily view (UTC day)
create or replace view public.vibescore_tracker_daily as
select
  user_id,
  date(token_timestamp at time zone 'UTC') as day,
  sum(total_tokens)::bigint as total_tokens,
  sum(input_tokens)::bigint as input_tokens,
  sum(cached_input_tokens)::bigint as cached_input_tokens,
  sum(output_tokens)::bigint as output_tokens,
  sum(reasoning_output_tokens)::bigint as reasoning_output_tokens
from public.vibescore_tracker_events
group by user_id, day;

