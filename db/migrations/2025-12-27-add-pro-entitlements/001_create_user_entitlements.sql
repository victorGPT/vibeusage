-- VibeScore Pro entitlements schema
-- Change: 2025-12-27-add-pro-entitlements

create table if not exists public.vibescore_user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  effective_from timestamptz not null,
  effective_to timestamptz not null,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.vibescore_user_entitlements enable row level security;

-- Admin policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vibescore_user_entitlements'
      AND policyname = 'project_admin_policy'
  ) THEN
    CREATE POLICY project_admin_policy ON public.vibescore_user_entitlements
      FOR ALL TO project_admin
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

-- User can read own entitlements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vibescore_user_entitlements'
      AND policyname = 'vibescore_user_entitlements_select'
  ) THEN
    CREATE POLICY vibescore_user_entitlements_select ON public.vibescore_user_entitlements
      FOR SELECT TO public
      USING (auth.uid() = user_id);
  END IF;
END$$;
