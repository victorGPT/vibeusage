-- Public dashboard share links
-- Change: 2026-01-12-add-public-dashboard-view

create table if not exists public.vibescore_public_views (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create unique index if not exists vibescore_public_views_token_hash_idx
  on public.vibescore_public_views (token_hash);

alter table public.vibescore_public_views enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_public_views'
      and policyname = 'project_admin_policy'
  ) then
    create policy project_admin_policy on public.vibescore_public_views
      for all to project_admin
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_public_views'
      and policyname = 'vibescore_public_views_select'
  ) then
    create policy vibescore_public_views_select on public.vibescore_public_views
      for select to public
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_public_views'
      and policyname = 'vibescore_public_views_insert'
  ) then
    create policy vibescore_public_views_insert on public.vibescore_public_views
      for insert to public
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_public_views'
      and policyname = 'vibescore_public_views_update'
  ) then
    create policy vibescore_public_views_update on public.vibescore_public_views
      for update to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;
