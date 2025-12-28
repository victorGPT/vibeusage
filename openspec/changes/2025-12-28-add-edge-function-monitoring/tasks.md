## 1. Spec
- [x] 1.1 Add requirement for structured logs on new edge functions.

## 2. Implementation
- [x] 2.1 Wrap new edge functions with request logging.
- [x] 2.2 Capture upstream status/latency in pricing sync.
- [x] 2.3 Rebuild insforge function bundles.

## 3. Tests & Regression
- [x] 3.1 Run `node --test test/edge-functions.test.js`.
- [x] 3.2 Run `node scripts/acceptance/usage-model-breakdown.cjs`.
- [x] 3.3 Run `node scripts/acceptance/openrouter-pricing-sync.cjs`.
- [x] 3.4 Record commands and results.
