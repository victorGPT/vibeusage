-- Change: 2025-12-18-fix-service-role-key-missing
-- Goal: Make core flows work without SERVICE_ROLE_KEY by relying on RLS.

-- 1) Request header helpers (PostgREST sets request.headers as JSON)
create or replace function public.vibescore_request_headers()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
$$;

create or replace function public.vibescore_request_header(name text)
returns text
language sql
stable
as $$
  select public.vibescore_request_headers() ->> lower(name);
$$;

create or replace function public.vibescore_device_token_hash()
returns text
language sql
stable
as $$
  select public.vibescore_request_header('x-vibescore-device-token-hash');
$$;

-- 2) Allow authenticated users to insert device tokens for their own devices.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_tracker_device_tokens'
      and policyname = 'vibescore_tracker_device_tokens_insert'
  ) then
    create policy vibescore_tracker_device_tokens_insert on public.vibescore_tracker_device_tokens
      for insert to public
      with check (
        auth.uid() = user_id
        and exists (
          select 1
          from public.vibescore_tracker_devices d
          where d.id = device_id
            and d.user_id = auth.uid()
        )
      );
  end if;
end$$;

-- 3) Allow device-token-based select on the specific token row (revoked tokens excluded).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_tracker_device_tokens'
      and policyname = 'vibescore_tracker_device_tokens_select_by_hash'
  ) then
    create policy vibescore_tracker_device_tokens_select_by_hash on public.vibescore_tracker_device_tokens
      for select to public
      using (
        revoked_at is null
        and token_hash = public.vibescore_device_token_hash()
      );
  end if;
end$$;

-- 4) Allow device-token-based ingest to insert events.
--
-- NOTE: The InsForge "/api/database/records" write path does not reliably expose custom request headers
-- via `request.headers` GUC during INSERT. We therefore authorize INSERTs using a SECURITY DEFINER helper
-- and the `device_token_id` column set by the ingest edge function.

alter table public.vibescore_tracker_events
  add column if not exists device_token_id uuid null references public.vibescore_tracker_device_tokens (id) on delete set null;

create index if not exists vibescore_tracker_events_device_token_id_idx
  on public.vibescore_tracker_events (device_token_id);

create or replace function public.vibescore_device_token_allows_event_insert(p_token_id uuid, p_user_id uuid, p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vibescore_tracker_device_tokens t
    where t.id = p_token_id
      and t.revoked_at is null
      and t.user_id = p_user_id
      and t.device_id = p_device_id
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_tracker_events'
      and policyname = 'vibescore_tracker_events_insert_by_device_token'
  ) then
    create policy vibescore_tracker_events_insert_by_device_token on public.vibescore_tracker_events
      for insert to public
      with check (public.vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id));
  else
    alter policy vibescore_tracker_events_insert_by_device_token on public.vibescore_tracker_events
      with check (public.vibescore_device_token_allows_event_insert(device_token_id, user_id, device_id));
  end if;
end$$;
