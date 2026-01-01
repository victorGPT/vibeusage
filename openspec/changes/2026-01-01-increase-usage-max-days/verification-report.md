# Verification Report

## Scope
- Default max-day guardrail change to 800 days.
- Documentation updates and regression coverage.

## Tests Run
- `node --test test/edge-functions.test.js --test-name-pattern="getUsageMaxDays defaults to 800 days"` (PASS)
- `npm test` (PASS)

## Results
- Default max-day test passed after updating `getUsageMaxDays()` to 800.
- Full test suite passed locally.
- Acceptance checks against production InsForge were not run (requires user JWT).

## Evidence
- Local test output recorded in CLI session (2026-01-01).
- Test command log: `npm test` exit code 0.

## Remaining Risks
- Larger default range may increase query latency on production workloads.
- Acceptance checks pending: 24‑month range 200 and oversized range 400 on production.
