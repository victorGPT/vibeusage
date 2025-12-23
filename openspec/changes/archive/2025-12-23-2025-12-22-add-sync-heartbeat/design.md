# Design: Sync heartbeat + missing buckets (day trend)

## Conclusion
Add a low-frequency sync heartbeat (device-token auth) so the backend can mark hourly buckets as "unsynced" when the latest sync is older than the bucket end. This preserves privacy, avoids extra load, and removes ambiguity between "no usage" and "not synced".

## Module Brief

### Scope
- **In**: device sync heartbeat; hourly API returns sync metadata and marks unsynced buckets; dashboard renders "unsynced" for day trend.
- **Out**: changes to event schema, daily/monthly aggregation logic, or historic backfill.

### Interfaces
- **CLI → Backend**: `POST /functions/vibescore-sync-ping` (device token auth) OR an equivalent `vibescore-ingest` short-circuit when no events.
- **Backend → Dashboard**: `GET /functions/vibescore-usage-hourly` adds `sync` metadata and `missing` flags.

### Data Flow & Constraints
1. CLI `sync` finishes parsing and upload.
2. If `inserted > 0`, ingest already updates device `last_seen_at` (heartbeat implied).
3. If `inserted === 0`, CLI sends a **throttled** heartbeat (min interval, 30 min).
4. Hourly endpoint reads the **latest sync time** (max across devices for user), then marks buckets **after** that timestamp as `missing`.

**Constraints**
- Must not increase backend load significantly (throttle on client and server).
- Must not store any conversational content; only timestamps.
- Works without service role key (fallback to records API or security definer RPC).

### Non-negotiables
- Heartbeat frequency MUST be bounded (minimum interval: 30 minutes).
- Missing/unsynced buckets MUST NOT be rendered as zero-usage.
- Device token remains the only long-lived credential for CLI.

### Test Strategy
- Unit: hour labeling → missing flag computation.
- Integration: `sync --no-events` triggers heartbeat after threshold.
- API: hourly response includes `sync.last_sync_at` and `missing` buckets after last sync.
- UI: day trend renders dashed markers and "未同步" tooltip for missing buckets.

### Milestones
1. **Heartbeat Storage**: backend accepts ping and persists `last_sync_at` (or `last_seen_at`).
2. **Hourly Response**: API returns `sync` metadata and `missing` buckets.
3. **UI Distinction**: dashboard renders missing buckets distinctly in day trend.
4. **Throttling**: client heartbeat frequency enforced (configurable; default 30 min).

### Plan B Triggers
- If heartbeat updates require elevated DB rights that are not available, fall back to a minimal `sync-ping` RPC (security definer) with device token hash validation.

### Upgrade Plan (disabled)
- None.
