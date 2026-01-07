## 1. Implementation
- [x] 1.1 Add shared usage aggregation module (single-pass totals + billable).
- [x] 1.2 Migrate usage endpoints to shared aggregator (daily/hourly/heatmap/monthly/summary/model-breakdown).
- [x] 1.3 Keep query shapes and response schemas unchanged.
- [x] 1.4 Regenerate InsForge functions (`npm run build:insforge`).

## 2. Tests
- [x] 2.1 Add unit tests for shared aggregator.
- [x] 2.2 Update/extend endpoint tests for consistency across endpoints (existing coverage reused).
- [x] 2.3 Run full suite (`node --test test/*.test.js`).

## 3. Docs
- [x] 3.1 Update any relevant docs if behavior notes change.
- [x] 3.2 Record verification commands/results.

## Verification
- [x] `npm run build:insforge` (PASS)
- [x] `node --test test/*.test.js` (PASS)
- [x] `node --test test/edge-functions.test.js` (PASS)
