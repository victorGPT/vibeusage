# Evidence Map: vibeusage-tracker

Source: `openspec/specs/vibeusage-tracker/spec.md`

This evidence map is intentionally focused on the live contracts that currently govern collection, backend ingestion, deployment, and dashboard presentation. Archived paths and retired CommonJS Edge Function entries are excluded on purpose.

## CLI collection, idempotency, and auth boundary

- Install / notify / uninstall flow:
  - `bin/tracker.js`
  - `src/cli.js`
  - `src/commands/init.js`
  - `src/commands/uninstall.js`
  - `src/lib/codex-config.js`
  - Verification path: `node --test test/init-uninstall.test.js test/init-dry-run.test.js test/init-spawn-error.test.js`
- Incremental parsing, allowlist extraction, and queue/idempotency:
  - `src/lib/rollout.js`
  - `src/lib/uploader.js`
  - `src/commands/sync.js`
  - Verification path: `node --test test/rollout-parser.test.js test/uploader.test.js`
- Device-token boundary and runtime config:
  - `src/lib/insforge.js`
  - `src/lib/insforge-client.js`
  - `src/lib/runtime-config.js`
  - Verification path: `node --test test/insforge-client.test.js test/runtime-config.test.js`
- Sync heartbeat:
  - `src/commands/sync.js`
  - `src/lib/insforge.js`
  - `insforge-src/functions-esm/vibeusage-sync-ping.js`
  - Verification path: `node scripts/acceptance/sync-heartbeat.cjs`

## Edge Function authoring and deployment contract

- Author source of truth:
  - `insforge-src/functions-esm/`
- Shared ESM helpers:
  - `insforge-src/functions-esm/shared/`
  - `insforge-src/shared/*.mjs`
- Generated deploy artifacts:
  - `insforge-functions/*.js`
- Build and local loader contract:
  - `scripts/build-insforge-functions.cjs`
  - `scripts/lib/load-edge-function.cjs`
  - Verification path: `node --test test/edge-functions.test.js test/insforge-esm-artifacts.test.js test/interaction-sequence-canvas.test.js`
  - Verification path: `npm run build:insforge`
  - Verification path: `npm run build:insforge:check`

## Ingest, token issuance, and replay safety

- Device token issuance:
  - `insforge-src/functions-esm/vibeusage-device-token-issue.js`
  - Verification path: `node scripts/acceptance/device-token-issue-compensation.cjs`
- Link-code init and exchange:
  - `insforge-src/functions-esm/vibeusage-link-code-init.js`
  - `insforge-src/functions-esm/vibeusage-link-code-exchange.js`
  - Verification path: `node scripts/acceptance/link-code-exchange.cjs`
- Ingest contract, concurrency guard, and DB write path:
  - `insforge-src/functions-esm/vibeusage-ingest.js`
  - `insforge-src/shared/concurrency.mjs`
  - `insforge-src/shared/core/ingest.mjs`
  - `insforge-src/shared/db/ingest.mjs`
  - Verification path: `node scripts/acceptance/ingest-duplicate-replay.cjs`
  - Verification path: `node scripts/acceptance/ingest-service-role-upsert.cjs`
  - Verification path: `node scripts/acceptance/ingest-batch-metrics.cjs`
  - Verification path: `node scripts/acceptance/ingest-concurrency-guard.cjs`
- Retention and ingest-batch cleanup:
  - `insforge-src/functions-esm/vibeusage-events-retention.js`
  - Verification path: `node --test test/edge-functions.test.js`

## Usage, leaderboard, visibility, and entitlement APIs

- Usage read endpoints:
  - `insforge-src/functions-esm/vibeusage-usage-summary.js`
  - `insforge-src/functions-esm/vibeusage-usage-daily.js`
  - `insforge-src/functions-esm/vibeusage-usage-hourly.js`
  - `insforge-src/functions-esm/vibeusage-usage-monthly.js`
  - `insforge-src/functions-esm/vibeusage-usage-heatmap.js`
  - `insforge-src/functions-esm/vibeusage-usage-model-breakdown.js`
  - `insforge-src/functions-esm/vibeusage-project-usage-summary.js`
  - Supporting shared modules:
    - `insforge-src/shared/env-core.mjs`
    - `insforge-src/shared/usage-hourly-query-core.mjs`
    - `insforge-src/shared/usage-rollup-core.mjs`
  - Verification path: `node --test test/edge-functions.test.js test/insforge-src-shared.test.js`
- Leaderboard, public-view, and visibility:
  - `insforge-src/functions-esm/vibeusage-leaderboard.js`
  - `insforge-src/functions-esm/vibeusage-leaderboard-refresh.js`
  - `insforge-src/functions-esm/vibeusage-leaderboard-profile.js`
  - `insforge-src/functions-esm/vibeusage-leaderboard-settings.js`
  - `insforge-src/functions-esm/vibeusage-public-view-issue.js`
  - `insforge-src/functions-esm/vibeusage-public-view-profile.js`
  - `insforge-src/functions-esm/vibeusage-public-view-revoke.js`
  - `insforge-src/functions-esm/vibeusage-public-view-status.js`
  - `insforge-src/functions-esm/vibeusage-public-visibility.js`
  - Verification path: `node --test test/public-view.test.js test/public-view-resolve.test.js test/edge-functions.test.js`
- Entitlements and user status:
  - `insforge-src/functions-esm/vibeusage-entitlements.js`
  - `insforge-src/functions-esm/vibeusage-entitlements-revoke.js`
  - `insforge-src/functions-esm/vibeusage-user-status.js`
  - Verification path: `node --test test/edge-functions.test.js`

## Dashboard presentation and copy contract

- Dashboard fetch, cache, and rendering:
  - `dashboard/src/hooks/`
  - `dashboard/src/lib/`
  - `dashboard/src/pages/DashboardPage.jsx`
- Public view and identity presentation:
  - `dashboard/src/ui/matrix-a/components/`
- Copy registry source of truth:
  - `dashboard/src/content/copy.csv`
- Verification path:
  - `node --test test/public-view.test.js`
  - `node --test test/edge-functions.test.js`

## Current hard-cut change record

- Active change:
  - `openspec/changes/2026-03-29-refactor-remaining-edge-functions-esm-hard-cut/`
- Stable contract:
  - `openspec/specs/vibeusage-tracker/spec.md`
- Release evidence:
  - `docs/deployment/freeze.md`
