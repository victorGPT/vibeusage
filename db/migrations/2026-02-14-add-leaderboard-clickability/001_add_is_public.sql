-- Add is_public column to leaderboard snapshots for clickability control
-- is_public = true only when leaderboard_public=true AND user has an active public link

alter table public.vibeusage_leaderboard_snapshots
  add column if not exists is_public boolean not null default false;

-- Backfill: set is_public=true only for users with leaderboard_public=true AND active public link
update public.vibeusage_leaderboard_snapshots s
set is_public = true
from public.vibeusage_user_settings us
join public.vibeusage_public_views pv on pv.user_id = us.user_id
where s.user_id = us.user_id
  and us.leaderboard_public = true
  and pv.revoked_at is null;

-- Create index for filtering public users
CREATE INDEX IF NOT EXISTS vibeusage_leaderboard_snapshots_is_public_idx
  ON public.vibeusage_leaderboard_snapshots (is_public)
  WHERE is_public = true;
