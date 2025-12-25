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
