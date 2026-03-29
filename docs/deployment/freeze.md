# Deployment Freeze Records

## Template: CI/CD Release Record

- Date:
- Scope:
- Change ID:
- CI workflow run:
- Release workflow run:
- Preflight: `node scripts/acceptance/model-identity-alias-table.cjs` (pass)
- npm publish: version + result (published or skipped)
- Vercel check: name + conclusion (if dashboard changed)
- MCP deploy: confirmation + evidence (if functions changed)
- Freeze artifact:
- Cold regression step:
- Synthetic acceptance:

## 2026-03-29-refactor-remaining-edge-functions-esm-hard-cut

- Date: 2026-03-29
- Scope: Remaining legacy Edge Functions hard-cut to the unified ESM-only author/build/load/deploy contract, plus runtime-safe ESM client loading for generated artifacts
- Change ID: `2026-03-29-refactor-remaining-edge-functions-esm-hard-cut`
- CI workflow run: pending post-push
- Release workflow run: N/A (manual function deploy only)
- Preflight: `node --test test/insforge-esm-artifacts.test.js test/edge-functions.test.js` (pass); `npm run build:insforge` (pass); `npm run build:insforge:check` (pass)
- npm publish: skipped
- Vercel check: not required (no dashboard changes in this loop)
- MCP deploy: refreshed the changed live `vibeusage-*` function slugs through Insforge MCP, including `vibeusage-usage-summary`, `vibeusage-project-usage-summary`, and `vibeusage-public-visibility`; deployment responses reported `deployment.status: success`
- MCP deploy evidence: live remote smoke against `https://5tmappuk.us-east.insforge.app/functions/*` now returns `401 Unauthorized` for representative protected endpoints instead of `500 Missing createClient`
- Freeze artifact: rebuilt `insforge-functions/*.js` from `insforge-src/functions-esm/` with a runtime-safe client loader that prefers injected `globalThis.createClient` and falls back to `await import("npm:@insforge/sdk")`; build preserves the npm import as an external dependency
- Cold regression step: `node --test test/insforge-esm-artifacts.test.js test/edge-functions.test.js`
- Synthetic acceptance: `/usr/bin/curl -i -H 'Authorization: Bearer foo.bar.baz' 'https://5tmappuk.us-east.insforge.app/functions/vibeusage-usage-summary'`; `/usr/bin/curl -i -H 'Authorization: Bearer foo.bar.baz' 'https://5tmappuk.us-east.insforge.app/functions/vibeusage-project-usage-summary'`; `/usr/bin/curl -i -H 'Authorization: Bearer foo.bar.baz' 'https://5tmappuk.us-east.insforge.app/functions/vibeusage-public-visibility'` (all return `401 Unauthorized`)

## 2026-02-09-add-leaderboard-period-month-total

- Date: 2026-02-09
- Scope: Leaderboard period selector (WEEK/MONTH/ALL) + month/total snapshots + public profile toggle + profile deep links
- Change ID: `2026-02-09-add-leaderboard-period-month-total`
- CI workflow run: N/A (manual deploy)
- Release workflow run: N/A (manual deploy)
- Preflight: N/A
- npm publish: skipped
- Vercel check: expected via Git integration on commit `8f4f5fce`
- MCP deploy: updated `vibeusage-leaderboard`, `vibeusage-leaderboard-refresh`, `vibeusage-leaderboard-profile`, `vibeusage-leaderboard-settings`
- Freeze artifact: commit `8f4f5fce` + DB SQL `openspec/changes/2026-02-09-add-leaderboard-period-month-total/sql/001_leaderboard_month_total.sql`
- Cold regression step: `npm test`, `npm --prefix dashboard test`, `npm run build:insforge:check` (pass)
- Synthetic acceptance: seed `month` + `total` rows in `vibeusage_leaderboard_snapshots` and verify counts are non-zero

## 2026-01-19-release-0.2.14

- Date: 2026-01-19
- Scope: CLI publish (vibeusage@0.2.14) + ops workflow endpoint cleanup
- Change ID: N/A (release)
- CI workflow run: 21134700364
- Release workflow run: 21134700364
- Preflight: `node scripts/acceptance/model-identity-alias-table.cjs` (pass)
- npm publish: vibeusage@0.2.14 (published)
- Vercel check: skipped (no dashboard changes)
- MCP deploy: skipped (no functions changes)
- Freeze artifact: CLI package `vibeusage@0.2.14`
- Cold regression step: `npm test` (pass)
- Synthetic acceptance: `VIBEUSAGE_RUN_NPX=1 node scripts/acceptance/npm-install-smoke.cjs` (pass)

## 2026-01-17-release-0.2.13

- Date: 2026-01-17
- Scope: CLI publish (vibeusage@0.2.13) + Release gate fix
- Change ID: N/A (release)
- CI workflow run: 21100397857
- Release workflow run: 21100457971
- Preflight: `node scripts/acceptance/model-identity-alias-table.cjs` (pass)
- npm publish: vibeusage@0.2.13 (published)
- Vercel check: skipped (no dashboard changes)
- MCP deploy: skipped (no functions changes)
- Freeze artifact: CLI package `vibeusage@0.2.13`
- Cold regression step: `npm test` (pass)
- Synthetic acceptance: `npx --yes vibeusage@0.2.13 --help` (pass)

## Runbook: Insforge MCP Deploy (Functions)

1. Ensure `insforge-functions/` matches `insforge-src/functions-esm/` (CI `build:insforge:check` or `npm run build:insforge`).
2. Use Insforge MCP deployment flow to deploy updated functions.
3. Record MCP output + confirmation in the release record above.

## 2026-01-12-add-public-dashboard-view

- Scope: dashboard public view share link (issue/revoke/status) + read-only usage access
- Change ID: `2026-01-12-add-public-dashboard-view`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node --test test/public-view.test.js` (pass)
- Synthetic acceptance: `node scripts/acceptance/public-view-link.cjs` (pass)
- Build check: `npm run build:insforge:check` (pass)

## 2025-12-31-add-ingest-guardrails

- Scope: M1 logs for ingest/token/sync, ingest concurrency guard, canary probe, usage canary exclusion
- Change ID: `2025-12-31-add-ingest-guardrails`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node --test test/edge-functions.test.js`
- Synthetic acceptance: `node scripts/acceptance/ingest-concurrency-guard.cjs`

## 2025-12-21-improve-ingest-resilience

- Scope: ingest duplicate handling, CLI backpressure defaults, dashboard probe rate
- Change ID: `2025-12-21-improve-ingest-resilience`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node scripts/acceptance/ingest-duplicate-replay.cjs`

## 2025-12-24-add-ingest-batch-metrics

- Scope: ingest batch metrics table + ingest best-effort metrics write + retention extension
- Change ID: `2025-12-24-add-ingest-batch-metrics`
- Freeze artifact: `insforge-functions/vibeusage-ingest.js`, `insforge-functions/vibeusage-events-retention.js` (built via `npm run build:insforge`)
- Cold regression step: `node scripts/acceptance/ingest-batch-metrics.cjs`

## 2025-12-25-usage-model-dimension

- Scope: model dimension in usage pipeline + usage model breakdown endpoint
- Change IDs: `2025-12-25-add-usage-model`, `2025-12-25-add-usage-model-breakdown`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node scripts/acceptance/usage-model-breakdown.cjs`

## 2025-12-25-pricing-pipeline

- Scope: pricing profiles table + OpenRouter pricing sync + pricing resolver defaults
- Change IDs: `2025-12-25-add-pricing-table`, `2025-12-25-add-openrouter-pricing-sync`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node scripts/acceptance/openrouter-pricing-sync.cjs`

## 2025-12-29-link-code-exchange-rpc

- Scope: link code exchange RPC path aligned to PostgREST `/rpc`
- Change ID: `fix-link-code-exchange-rpc-path` (bug fix; no OpenSpec change)
- Freeze artifact: `insforge-functions/vibeusage-link-code-exchange.js` (built via `npm run build:insforge`)
- Cold regression step: `node scripts/acceptance/link-code-exchange.cjs`

## 2025-12-29-link-code-exchange-records

- Scope: link code exchange uses records API (no RPC dependency)
- Change ID: `fix-link-code-exchange-records` (bug fix; no OpenSpec change)
- Freeze artifact: `insforge-functions/vibeusage-link-code-exchange.js` (built via `npm run build:insforge`)
- Cold regression step: `node scripts/acceptance/link-code-exchange.cjs`

## 2025-12-29-add-opencode-usage

- Scope: Opencode plugin hook + local storage parser + sync integration
- Change ID: `2025-12-29-add-opencode-usage`
- Freeze artifact: CLI package `vibeusage` (publish from this commit)
- Cold regression step: `node scripts/acceptance/opencode-plugin-install.cjs`

## 2025-12-30-add-gemini-cli-hooks

- Scope: Gemini CLI SessionEnd hook + auto hook enablement + status/diagnostics
- Change ID: `2025-12-30-add-gemini-cli-hooks`
- Freeze artifact: CLI package `vibeusage` (publish from this commit)
- Cold regression step: `node scripts/acceptance/gemini-hook-install.cjs`

## 2025-12-30-cli-init-ux-sync-guard

- Scope: CLI init UX messaging + deferred browser open + auto sync guard (no token)
- Change ID: `2025-12-30-cli-init-ux-sync-guard` (no OpenSpec change)
- Freeze artifact: CLI package `vibeusage` (publish from this commit)
- Cold regression step: `node --test test/init-uninstall.test.js test/init-spawn-error.test.js`
- Synthetic acceptance: `node scripts/acceptance/notify-local-runtime-deps.cjs`

## 2025-12-31-dashboard-screenshot-share

- Scope: dashboard screenshot capture + clipboard write + X share gate
- Change ID: `2025-12-30-add-dashboard-screenshot-mode`
- Freeze artifact: dashboard build (`npm --prefix dashboard run build`)
- Cold regression step: `node dashboard/scripts/verify-share-clipboard.mjs "http://localhost:5173/?screenshot=1"`
