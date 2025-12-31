# Test Strategy

## Objectives
- Verify ingest concurrency guard behavior (429 + Retry-After).
- Verify M1 logging fields exist without payload leakage.
- Verify canary script produces a valid ingest request shape.

## Test Levels
- Unit: concurrency guard helper.
- Integration: `vibescore-ingest` returns 429 when inflight exceeds limit (mocked fetch).
- Regression: existing ingest happy path still returns 200 and inserts buckets.
- Performance: not required; guard is constant-time check.

## Test Matrix
- M1 logging -> Integration -> Backend -> Console log capture (synthetic)
- Concurrency guard -> Integration -> Backend -> `scripts/acceptance/ingest-concurrency-guard.cjs`
- Canary script -> Regression -> Ops -> `scripts/ops/ingest-canary.cjs` dry run with env
- Canary exclusion -> Integration -> Backend -> usage endpoint query filter assertions

## Environments
- Local Node (tests + acceptance script with mocks)

## Automation Plan
- Run node acceptance script for concurrency guard.
- Optional: run `node --test test/edge-functions.test.js` for regression.

## Entry / Exit Criteria
- Entry: specs updated; code changes complete.
- Exit: acceptance script passes; no regression in ingest tests.

## Coverage Risks
- Logs are validated synthetically; real platform log pipeline not exercised.
