# Runbook: Auto Sync Health Check

## 1) Quick health check (recommended)
Run:
```
node bin/tracker.js status --diagnostics
```

## 2) Interpret the output (health criteria)
**Core chain (first principles):**
`codex notify configured` → `notify signal updated` → `sync spawned` → `queue pending drains` → `upload throttle ok`.

### OK (auto sync working)
- `notify.codex_notify_configured = true`
- `notify.last_notify` recent (user actually ran Codex recently)
- `notify.last_notify_triggered_sync` exists and is ~same timestamp as `last_notify`
- `queue.pending_bytes = 0`
- `upload.backoff_until = null`

### IDLE (not a failure)
- `notify.codex_notify_configured = true`
- `notify.last_notify = null` **or** very old
- `queue.pending_bytes = 0`
> Usually means no new Codex turns happened yet.

### DEGRADED
- `notify.codex_notify_configured = false` **OR**
- `notify.last_notify` recent but `last_notify_triggered_sync` missing **OR**
- `queue.pending_bytes > 0` while `upload.next_allowed_after` far in the future **OR**
- `upload.backoff_until` is set (recent upload failures)

## 3) If DEGRADED, suggested actions
- Re-run `npx @vibescore/tracker init` to restore notify.
- Run `npx @vibescore/tracker sync --drain` to force upload.
- Check `status` output for `last_error` and retry after `backoff_until`.

## 4) Minimal evidence checklist
Record the following from diagnostics:
- `last_notify`
- `last_notify_triggered_sync`
- `queue.pending_bytes`
- `upload.last_success_at`
- `upload.next_allowed_after`
- `upload.backoff_until`
