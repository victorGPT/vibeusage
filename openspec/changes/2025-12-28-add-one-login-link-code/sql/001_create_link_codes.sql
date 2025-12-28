-- VibeScore link code schema
-- Change: 2025-12-28-add-one-login-link-code

create table if not exists public.vibescore_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique,
  session_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  request_id text,
  device_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists vibescore_link_codes_expires_at_idx
  on public.vibescore_link_codes (expires_at);

alter table public.vibescore_link_codes enable row level security;

do $$ begin
  create policy vibescore_link_codes_insert_self on public.vibescore_link_codes
    for insert to authenticated
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
