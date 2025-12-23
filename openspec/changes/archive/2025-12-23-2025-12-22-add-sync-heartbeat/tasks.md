## 1. Backend heartbeat
- [x] 1.1 Decide persistence field (`vibescore_tracker_devices.last_seen_at` vs new `last_sync_at`) and access path (service role vs records API vs RPC)
- [x] 1.2 Add `POST /functions/vibescore-sync-ping` (device token auth, idempotent, returns last_sync_at)
- [x] 1.3 Enforce server-side min-interval (ignore pings < 30 min)

## 2. Hourly response
- [x] 2.1 Compute `last_sync_at` (max across devices for user)
- [x] 2.2 Mark hourly buckets after `last_sync_at` as `missing: true`
- [x] 2.3 Return `sync` metadata (last_sync_at, min_interval_minutes)

## 3. CLI throttling
- [x] 3.1 Add local heartbeat state (timestamp) persisted under `~/.vibescore/tracker/`
- [x] 3.2 Send heartbeat only when `inserted === 0` and last ping > min interval (30 min)
- [x] 3.3 Ensure heartbeat never blocks Codex notify (best-effort + timeout)

## 4. Dashboard UI
- [x] 4.1 Respect `missing` in day trend (dashed markers + tooltip "未同步")
- [x] 4.2 Add UI indicator for sync freshness (optional, low-visibility)

## 5. Docs + Validation
- [x] 5.1 Update `BACKEND_API.md` for new endpoint/response fields
- [x] 5.2 Add acceptance script for heartbeat + hourly missing
- [x] 5.3 Manual verification: run `sync` with no new events, confirm UI shows "未同步" for hours after last sync
