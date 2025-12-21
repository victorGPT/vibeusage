# Deployment Freeze Records

## 2025-12-21-improve-ingest-resilience
- Scope: ingest duplicate handling, CLI backpressure defaults, dashboard probe rate
- Change ID: `2025-12-21-improve-ingest-resilience`
- Freeze artifact: update `insforge-functions/` via `npm run build:insforge`
- Cold regression step: `node scripts/acceptance/ingest-duplicate-replay.cjs`
