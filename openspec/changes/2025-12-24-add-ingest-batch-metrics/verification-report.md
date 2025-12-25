# Verification Report

## Scope
- Ingest batch metrics logging + retention.

## Tests Run
- `node scripts/acceptance/ingest-batch-metrics.cjs`
- SQL: per-minute metrics counts (last 7 days)
- SQL: retention delete for rows older than 30 days (synthetic row)
- Deploy: `npm run build:insforge`, update edge functions `vibescore-ingest` + `vibescore-events-retention`
- Live ingest probe: POST `/functions/vibescore-ingest` with a minimal bucket (source=`metrics-probe`, zero tokens)

## Results
- Acceptance script passed (metrics success path + metrics failure path do not block ingest).
- Metrics table query returned 0 rows in last 7 days (no live ingest metrics observed yet).
- Retention SQL deleted a synthetic row older than 30 days.
- Edge functions updated successfully (see Evidence).
- Live ingest probe returned `502 Bad Gateway`; metrics table query could not be executed afterwards due to upstream HTML error.

## 2025-12-25 Local Verification
### Tests Run
- `node scripts/acceptance/ingest-batch-metrics.cjs`
- `node --test test/edge-functions.test.js`

### Results
- Acceptance script passed (`metrics-ok` + `metrics-fail` scenarios).
- `test/edge-functions.test.js` passed after updating anonKey ingest expectations to include ingest batch metrics call.

## Evidence
- `scripts/acceptance/ingest-batch-metrics.cjs` output:
  - `metrics-ok` inserted=2 skipped=0 metrics_inserted=true metrics_source=mixed
  - `metrics-fail` inserted=2 skipped=0 metrics_inserted=false
- SQL (metrics per-minute): returned 0 rows in last 7 days.
- SQL (retention): inserted 1 synthetic row (created_at older than 30 days), delete returned 1 row, count after delete = 0.
- Build output: `Built 13 InsForge edge functions into insforge-functions/`
- Deploy results:
  - `vibescore-ingest` updated_at=2025-12-24T21:08:33.025Z
  - `vibescore-events-retention` updated_at=2025-12-24T21:08:33.738Z
- Live ingest probe response:
  - HTTP 502 with `openresty/1.27.1.2` error page (timeout cleared at ~17.5s)

## Remaining Risks
- Ingest endpoint returned 502 during live probe; need backend availability check before confirming metrics are written in production.
