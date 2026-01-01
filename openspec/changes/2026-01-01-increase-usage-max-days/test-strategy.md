# Test Strategy

## Objectives
- Confirm the default guardrail is 800 days.
- Preserve existing behavior for env overrides and response contracts.

## Test Levels
- Unit:
  - `getUsageMaxDays()` returns 800 when env is unset.
  - Env override (e.g., 30 days) remains enforced.
- Integration:
  - `vibescore-usage-summary` accepts a 24-month window by default.
  - Oversized range returns 400.
- Regression:
  - Existing edge-function tests pass (`npm test`).

## Test Matrix
- Default limit -> Unit/Integration -> 200 for <= 800 days
- Oversized range -> Integration -> 400 with max-day message
- Env override -> Unit/Integration -> 400 for > override

## Environments
- Local tests (Node) for unit/contract.
- Remote InsForge for acceptance checks.

## Automation Plan
- Extend `test/edge-functions.test.js` to assert default `getUsageMaxDays()` value.
- Use curl or existing scripts for acceptance checks.

## Entry / Exit Criteria
- Entry: OpenSpec change approved.
- Exit: Acceptance criteria met; regression statement recorded.

## Coverage Risks
- Remote acceptance checks require valid user JWT and active data window.
