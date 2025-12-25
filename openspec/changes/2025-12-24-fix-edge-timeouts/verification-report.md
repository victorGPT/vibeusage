# Verification Report

## Scope
- Usage endpoints use JWT payload fast path to avoid auth roundtrip.

## Tests Run
- `node --test test/edge-functions.test.js`
- Live ingest probe: POST `/functions/vibescore-ingest` with a minimal bucket (source=`timeout-probe`, zero tokens) using device token from local config; `curl --max-time 20` and capture `time_total`.

## Results
- Passed
- Ingest probe returned `200` in `1.591s`; response `{ "success": true, "inserted": 1, "skipped": 0 }`.

## Evidence
- `test/edge-functions.test.js` all 19 tests passed.

## Remaining Risks
- Not load-tested; single-probe latency only.
