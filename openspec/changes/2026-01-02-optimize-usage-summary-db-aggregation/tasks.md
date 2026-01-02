## 1. Database / RPC
- [ ] 1.1 Draft SQL for RPC `vibescore_usage_summary_agg` (RLS-safe, `SUM` + `COALESCE`, group by `source`, `model`).
- [ ] 1.2 Add SQL file under `openspec/changes/2026-01-02-optimize-usage-summary-db-aggregation/sql/001_usage_summary_agg.sql`.
- [ ] 1.3 Define expected RPC signature and response shape (document in `BACKEND_API.md`).

## 2. Edge Function
- [ ] 2.1 Update `insforge-src/functions/vibescore-usage-summary.js` to call RPC instead of scanning hourly rows.
- [ ] 2.2 Preserve pricing computation and debug payload semantics.
- [ ] 2.3 Add slow-query fields: `rows_out`/`group_count`.
- [ ] 2.4 Rebuild `insforge-functions/` via `npm run build:insforge`.

## 3. Tests & Regression
- [ ] 3.1 Add acceptance script: `scripts/acceptance/usage-summary-agg.cjs` (RPC vs scan totals).
- [ ] 3.2 Update `test/edge-functions.test.js` for RPC mocks and response parity.
- [ ] 3.3 Run regression: `node --test test/edge-functions.test.js` + `node --test test/dashboard-function-path.test.js`.

## 4. Docs & Canvas
- [ ] 4.1 Update `BACKEND_API.md` with RPC details and no-lag guarantee.
- [ ] 4.2 Refresh `architecture.canvas` and `interaction_sequence.canvas` after implementation.

## 5. Verification
- [ ] 5.1 Record verification steps + results in `verification-report.md`.
