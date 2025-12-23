# Change: Add sync heartbeat to distinguish unsynced vs no-usage

## Why
The day trend view cannot distinguish "no usage" from "not synced" because hourly buckets only reflect uploaded events. This causes user confusion when they used Codex recently but see a flat zero line.

## What Changes
- Add a throttled device sync heartbeat so the backend knows the latest successful sync attempt even when no events were uploaded.
- Expose sync freshness in the hourly usage response and mark future/unsynced buckets.
- Update the dashboard day trend to surface "unsynced" buckets separately from true zero-usage hours.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: CLI `sync` flow, backend edge functions (`vibescore-usage-hourly`, new `vibescore-sync-ping`), dashboard trend rendering.
- Data changes: store/update device `last_sync_at` (or reuse `last_seen_at`) and return sync metadata in hourly responses.
