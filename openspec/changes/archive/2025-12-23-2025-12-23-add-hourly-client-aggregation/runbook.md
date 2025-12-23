# Runbook: Events Retention (30 days)

## Goal
Purge legacy `vibescore_tracker_events` rows older than 30 days to meet retention requirements and keep storage bounded.

## Preconditions
- You have admin access to InsForge (project admin / service role).
- The half-hour table (`vibescore_tracker_hourly`) is in place and backfilled.

## Step 1: Measure impact
Run:
```
select count(*)::int as rows_to_delete
from public.vibescore_tracker_events
where token_timestamp < now() - interval '30 days';
```

If `rows_to_delete` is large, consider running during off-peak hours.

## Step 2: Execute purge
Run:
```
delete from public.vibescore_tracker_events
where token_timestamp < now() - interval '30 days';
```

## Step 3: Verify
Run:
```
select count(*)::int as remaining_old_rows
from public.vibescore_tracker_events
where token_timestamp < now() - interval '30 days';
```
Expected: `remaining_old_rows = 0` (or close to 0 if rows are added concurrently).

## Step 4: Record evidence
Record date/time, affected rows, and operator in the change tasks.

## Notes
- This is a destructive operation; there is no rollback without backups.
- If you need to preserve raw data for longer, export before purge.

## Automation (recommended)
Use the Edge Function `vibescore-events-retention` and schedule it via GitHub Actions (daily, UTC).

### Function invocation (manual)
Send a POST with service role token:
```
POST /functions/vibescore-events-retention
Authorization: Bearer <INSFORGE_SERVICE_ROLE_KEY>
Content-Type: application/json

{"days":30,"dry_run":false}
```

### GitHub Actions setup
- Workflow: `.github/workflows/vibescore-events-retention.yml`
- Schedule: daily at 02:30 UTC (`30 2 * * *`)
- Secrets required:
  - `INSFORGE_BASE_URL` (example: `https://5tmappuk.us-east.insforge.app`)
  - `INSFORGE_SERVICE_ROLE_KEY` (or `INSFORGE_API_KEY`)
- Payload: `{"days":30,"dry_run":false}` (set `dry_run` to `true` for validation)

### Dry-run
Set `dry_run: true` to return the count without deleting.
