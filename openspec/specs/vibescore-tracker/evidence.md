# Evidence Map: vibescore-tracker

Source: `openspec/specs/vibescore-tracker/spec.md`

## Legend
- Status: Implemented | Partial | Gap
- Verification: script/test or manual steps (environment-dependent).

## Requirements

### Requirement: CLI installation and commands
- Implementation: `bin/tracker.js`, `src/cli.js`, `src/commands/init.js`, `src/commands/sync.js`, `src/commands/status.js`, `src/commands/uninstall.js`, `package.json#bin`
- Verification: manual `node bin/tracker.js --help`; `node --test test/*.test.js` (init/uninstall/status)
- Status: Implemented

### Requirement: Public npm distribution for CLI
- Implementation: `package.json` (`name=@vibescore/tracker`, `publishConfig.access=public`)
- Verification: manual `npx --yes @vibescore/tracker --help` (requires published package)
- Status: Partial (release-dependent)

### Requirement: Notify hook install is safe and reversible
- Implementation: `src/commands/init.js`, `src/lib/codex-config.js`, `src/commands/uninstall.js`
- Verification: `node --test test/init-uninstall.test.js`
- Status: Implemented

### Requirement: Notify handler is non-blocking and safe
- Implementation: `src/commands/init.js` (`buildNotifyHandler` writes `notify.cjs`, spawns detached, exits 0)
- Verification: manual run `~/.vibescore/bin/notify.cjs` after `init`, confirm exit 0
- Status: Implemented (manual)

### Requirement: Incremental parsing with a strict data allowlist
- Implementation: `src/lib/rollout.js` (`payload.type === "token_count"` + explicit field allowlist)
- Verification: `node --test test/rollout-parser.test.js`
- Status: Implemented

### Requirement: Client-side idempotency
- Implementation: `src/lib/rollout.js` (half-hour bucket aggregation + queuedKey + cursors), `src/commands/sync.js` (cursor persistence)
- Verification: `node --test test/rollout-parser.test.js`; manual run `tracker sync` twice with no new events
- Status: Implemented (manual)

### Requirement: Auto sync uploads are throttled to half-hour cadence
- Implementation: `src/lib/upload-throttle.js` (30 min interval), `src/commands/sync.js` (auto-only throttle), `src/commands/init.js` (init triggers sync)
- Verification: `node --test test/upload-throttle.test.js`; `node --test test/init-uninstall.test.js`
- Status: Implemented

### Requirement: Raw event retention is capped
- Implementation: `insforge-src/functions/vibescore-events-retention.js`, `openspec/changes/2025-12-23-add-hourly-client-aggregation/sql/003_purge_events_older_than_30d.sql`, `openspec/changes/2025-12-23-add-hourly-client-aggregation/runbook.md`, `.github/workflows/vibescore-events-retention.yml`
- Verification: manual SQL purge or run the GitHub Actions workflow with service role token
- Status: Implemented (manual + scheduled if secrets configured)

### Requirement: Device token authentication boundary
- Implementation: `src/commands/init.js` (stores device token), `src/lib/insforge.js`, `src/lib/insforge-client.js`
- Verification: manual inspect `~/.vibescore/tracker/config.json` (no user JWT stored)
- Status: Implemented (manual)

### Requirement: Sync heartbeat records freshness
- Implementation: `src/commands/sync.js` (`maybeSendHeartbeat`), `src/lib/insforge.js` (`syncHeartbeat`), `insforge-src/functions/vibescore-sync-ping.js`
- Verification: `scripts/acceptance/sync-heartbeat.cjs`
- Status: Implemented

### Requirement: Hourly usage marks unsynced buckets
- Implementation: `insforge-src/functions/vibescore-usage-hourly.js`, `dashboard/src/hooks/use-trend-data.js`
- Verification: `scripts/acceptance/usage-hourly-missing.cjs`
- Status: Implemented

### Requirement: Dashboard UI is retro-TUI themed (visual only)
- Implementation: `dashboard/src/ui/matrix-a/**`, `dashboard/src/pages/DashboardPage.jsx`
- Verification: manual visual check of dashboard
- Status: Implemented (manual)

### Requirement: UI and data logic are decoupled
- Implementation: data hooks under `dashboard/src/hooks/**`, UI components under `dashboard/src/ui/**`
- Verification: manual code review
- Status: Implemented (manual)

### Requirement: Dashboard shows a boot screen (visual only)
- Implementation: `dashboard/src/ui/matrix-a/components/BootScreen.jsx`, `dashboard/src/pages/DashboardPage.jsx`
- Verification: manual page load; observe boot screen delay
- Status: Implemented (manual)

### Requirement: Dashboard provides a GitHub-inspired activity heatmap
- Implementation: `dashboard/src/hooks/use-activity-heatmap.js`, `dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`, `insforge-src/functions/vibescore-usage-heatmap.js`
- Verification: `test/edge-functions.test.js` (heatmap contract); manual UI
- Status: Implemented

### Requirement: Dashboard surfaces timezone basis for usage data
- Implementation: `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`, `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`, `dashboard/src/lib/timezone.js`, `dashboard/src/content/copy.csv`
- Verification: manual UI check of time zone label consistency
- Status: Implemented (manual)

### Requirement: Dashboard does not support custom date filters
- Implementation: `dashboard/src/pages/DashboardPage.jsx` (`PERIODS` only)
- Verification: manual UI inspection (no date picker)
- Status: Implemented (manual)

### Requirement: Dashboard TREND truncates future buckets
- Implementation: `dashboard/src/hooks/use-trend-data.js` (future flags), `dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`
- Verification: manual check during mid-period (line stops before future buckets)
- Status: Implemented (manual)

### Requirement: Leaderboard endpoint is available (calendar day/week/month/total)
- Implementation: `insforge-src/functions/vibescore-leaderboard.js`
- Verification: `test/edge-functions.test.js` (leaderboard tests), `scripts/acceptance/leaderboard-limit.cjs`, `scripts/acceptance/leaderboard-single-query.cjs`
- Status: Implemented

### Requirement: Leaderboard response includes generation timestamp
- Implementation: `insforge-src/functions/vibescore-leaderboard.js`
- Verification: `test/edge-functions.test.js` (asserts `generated_at`)
- Status: Implemented

### Requirement: Leaderboard response includes `me`
- Implementation: `insforge-src/functions/vibescore-leaderboard.js`
- Verification: `test/edge-functions.test.js` (leaderboard tests), `scripts/smoke/insforge-smoke.cjs`
- Status: Implemented

### Requirement: Leaderboard output is privacy-safe
- Implementation: `insforge-src/functions/vibescore-leaderboard.js` (selects `display_name`, `avatar_url` only)
- Verification: manual code review; optional API response inspection
- Status: Implemented (manual)

### Requirement: Leaderboard is anonymous by default
- Implementation: `insforge-src/functions/vibescore-leaderboard-refresh.js` (snapshot fields), `insforge-src/functions/vibescore-leaderboard.js`
- Verification: manual API inspection (unauthorized profile should be anonymized)
- Status: Partial (needs explicit verification)

### Requirement: Leaderboard enforces safe limits
- Implementation: `insforge-src/functions/vibescore-leaderboard.js` (period/limit validation)
- Verification: `test/edge-functions.test.js` (invalid period), `scripts/acceptance/leaderboard-limit.cjs`
- Status: Implemented

### Requirement: Leaderboard snapshots can be refreshed by automation
- Implementation: `insforge-src/functions/vibescore-leaderboard-refresh.js`, `.github/workflows/vibescore-leaderboard-refresh.yml`
- Verification: manual workflow run or curl with service role
- Status: Implemented (manual)

### Requirement: Leaderboard privacy setting can be updated
- Implementation: `insforge-src/functions/vibescore-leaderboard-settings.js`
- Verification: `test/edge-functions.test.js` (settings tests), `scripts/acceptance/leaderboard-settings-replay.cjs`
- Status: Implemented

### Requirement: Dashboard shows identity information from login state
- Implementation: `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/components/IdentityCard.jsx`
- Verification: manual sign-in UI check
- Status: Implemented (manual)

### Requirement: Debug output includes backend status and code
- Implementation: `dashboard/src/components/BackendStatus.jsx`, `dashboard/src/hooks/use-backend-status.js`
- Verification: manual hover/inspect status tooltip
- Status: Implemented (manual)

### Requirement: Dashboard compositing effects are GPU-budgeted
- Implementation: pending optimization work (`openspec/changes/2025-12-22-investigate-dashboard-gpu-spikes`, `openspec/changes/2025-12-22-optimize-matrix-rain-gpu`)
- Verification: requires performance trace with defined GPU metrics
- Status: Gap

### Requirement: Matrix rain cost is further reduced
- Implementation: `dashboard/src/ui/matrix-a/components/MatrixRain.jsx` (reduced motion scaling, fps cap)
- Verification: performance trace comparing baseline vs reduced settings
- Status: Partial (optimization change in progress)
