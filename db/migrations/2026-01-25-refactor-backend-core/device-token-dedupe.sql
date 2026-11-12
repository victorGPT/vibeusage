-- Device token active dedupe + partial unique index
-- Purpose: ensure one active token per (user_id, device_id)
-- Notes:
-- - Run during maintenance window.
-- - This script is idempotent for dedupe + index creation.
-- - Use CONCURRENTLY; must be executed outside a transaction.
-- - No compatibility paths; aligns with hard cutover.

-- 0) Pre-scan (should be 0 after dedupe)
select user_id, device_id, count(*) as active_count
from vibeusage_tracker_device_tokens
where revoked_at is null
group by user_id, device_id
having count(*) > 1
order by active_count desc;

-- 1) Dedupe size (rows to revoke)
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, device_id
      order by created_at desc, last_used_at desc nulls last, id desc
    ) as rn
  from vibeusage_tracker_device_tokens
  where revoked_at is null
)
select count(*) as revoke_rows
from ranked
where rn > 1;

-- 2) Dedupe active tokens: keep latest by created_at, fallback last_used_at
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, device_id
      order by created_at desc, last_used_at desc nulls last, id desc
    ) as rn
  from vibeusage_tracker_device_tokens
  where revoked_at is null
)
update vibeusage_tracker_device_tokens t
set revoked_at = now()
from ranked r
where t.id = r.id
  and r.rn > 1;

-- 3) Create partial unique index for active tokens
create unique index concurrently if not exists vibeusage_tracker_device_tokens_active_uniq
on vibeusage_tracker_device_tokens (user_id, device_id)
where revoked_at is null;

-- 4) Post-check
select user_id, device_id, count(*) as active_count
from vibeusage_tracker_device_tokens
where revoked_at is null
group by user_id, device_id
having count(*) > 1
order by active_count desc;

-- 5) Rollback (index only; data rollback is not automated)
-- drop index if exists vibeusage_tracker_device_tokens_active_uniq;
