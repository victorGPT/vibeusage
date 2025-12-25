-- Create ingest batch metrics table for VibeScore tracker.

create table if not exists public.vibescore_tracker_ingest_batches (
  batch_id bigserial primary key,
  user_id uuid not null,
  device_id uuid not null,
  device_token_id uuid null references public.vibescore_tracker_device_tokens (id) on delete set null,
  source text null,
  bucket_count integer not null default 0,
  inserted integer not null default 0,
  skipped integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vibescore_tracker_ingest_batches_created_at_idx
  on public.vibescore_tracker_ingest_batches (created_at desc);

create index if not exists vibescore_tracker_ingest_batches_user_created_at_idx
  on public.vibescore_tracker_ingest_batches (user_id, created_at desc);

alter table public.vibescore_tracker_ingest_batches enable row level security;

do $$ begin
  create policy project_admin_policy on public.vibescore_tracker_ingest_batches
    for all to project_admin using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy vibescore_tracker_ingest_batches_insert_by_device_token on public.vibescore_tracker_ingest_batches
    for insert to public
    with check (public.vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id));
exception when duplicate_object then null; end $$;
