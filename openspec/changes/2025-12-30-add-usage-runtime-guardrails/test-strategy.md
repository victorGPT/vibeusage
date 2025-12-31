# Test Strategy

## Objectives
- Verify guardrails block oversized date ranges without breaking valid usage queries.
- Verify slow-query logs are emitted only when thresholds are exceeded.
- Preserve existing API response contracts for valid requests.

## Test Levels
- Unit:
  - Range validation helper (max days enforcement).
  - Slow-query logging threshold behavior.
- Integration:
  - Usage endpoints return 400 on oversized ranges.
  - Usage endpoints return 200 on allowed ranges.
- Regression:
  - Existing edge-function tests pass (`npm test`).
  - Smoke run for usage summary/daily endpoints (if environment available).
- Performance:
  - Manual verification: observe `slow_query` logs when simulating large ranges or artificial delays.

## Test Matrix
- Range limit -> Integration -> Backend -> API response 400/200
- Slow-query logging -> Unit/Integration -> Backend -> log payload includes required fields
- Heatmap limits -> Integration -> Backend -> 400 on invalid weeks

## Environments
- Local tests (Node) for unit/contract tests.
- Staging or prod InsForge environment for log verification.

## Automation Plan
- Add/extend unit tests in `test/edge-functions.test.js` for range validation and logging threshold.
- Add acceptance script or extend existing usage scripts for oversized ranges.

## Entry / Exit Criteria
- Entry:
  - OpenSpec change approved.
  - Thresholds agreed (`VIBESCORE_SLOW_QUERY_MS`, `VIBESCORE_USAGE_MAX_DAYS`).
- Exit:
  - All acceptance criteria satisfied.
  - Regression declaration completed.

## Coverage Risks
- Log validation depends on access to InsForge logs.
- Range validation may diverge from dashboard expectations if thresholds are wrong.
