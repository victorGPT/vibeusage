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
