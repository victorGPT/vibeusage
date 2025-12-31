# Deployment Freeze Records

## 2025-12-21-improve-ingest-resilience
- Scope: ingest duplicate handling, CLI backpressure defaults, dashboard probe rate
- Change ID: `2025-12-21-improve-ingest-resilience`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node scripts/acceptance/ingest-duplicate-replay.cjs`

## 2025-12-24-add-ingest-batch-metrics
- Scope: ingest batch metrics table + ingest best-effort metrics write + retention extension
- Change ID: `2025-12-24-add-ingest-batch-metrics`
- Freeze artifact: `insforge-functions/vibescore-ingest.js`, `insforge-functions/vibescore-events-retention.js` (built via `npm run build:insforge`)
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
- Freeze artifact: `insforge-functions/vibescore-link-code-exchange.js` (built via `npm run build:insforge`)
- Cold regression step: `node scripts/acceptance/link-code-exchange.cjs`

## 2025-12-29-link-code-exchange-records
- Scope: link code exchange uses records API (no RPC dependency)
- Change ID: `fix-link-code-exchange-records` (bug fix; no OpenSpec change)
- Freeze artifact: `insforge-functions/vibescore-link-code-exchange.js` (built via `npm run build:insforge`)
- Cold regression step: `node scripts/acceptance/link-code-exchange.cjs`

## 2025-12-29-add-opencode-usage
- Scope: Opencode plugin hook + local storage parser + sync integration
- Change ID: `2025-12-29-add-opencode-usage`
- Freeze artifact: CLI package `@vibescore/tracker` (publish from this commit)
- Cold regression step: `node scripts/acceptance/opencode-plugin-install.cjs`

## 2025-12-30-add-gemini-cli-hooks
- Scope: Gemini CLI SessionEnd hook + auto hook enablement + status/diagnostics
- Change ID: `2025-12-30-add-gemini-cli-hooks`
- Freeze artifact: CLI package `@vibescore/tracker` (publish from this commit)
- Cold regression step: `node scripts/acceptance/gemini-hook-install.cjs`

## 2025-12-30-cli-init-ux-sync-guard
- Scope: CLI init UX messaging + deferred browser open + auto sync guard (no token)
- Change ID: `2025-12-30-cli-init-ux-sync-guard` (no OpenSpec change)
- Freeze artifact: CLI package `@vibescore/tracker` (publish from this commit)
- Cold regression step: `node --test test/init-uninstall.test.js test/init-spawn-error.test.js`
- Synthetic acceptance: `node scripts/acceptance/notify-local-runtime-deps.cjs`

## 2025-12-31-dashboard-screenshot-share
- Scope: dashboard screenshot capture + clipboard write + X share gate
- Change ID: `2025-12-30-add-dashboard-screenshot-mode`
- Freeze artifact: dashboard build (`npm --prefix dashboard run build`)
- Cold regression step: `node dashboard/scripts/verify-share-clipboard.mjs "http://localhost:5173/?screenshot=1"`
