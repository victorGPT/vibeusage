# Test Strategy

## Objectives
- Ensure new UI components render without errors and comply with copy registry rules.
- Confirm titles and labels use the intended mainstream terminology.

## Test Levels
- Unit: Not available (no existing UI unit test harness).
- Integration: Manual render in dashboard dev environment.
- Regression: Ensure existing dashboard pages load without errors.
- Performance: N/A.

## Test Matrix
- Map component renders -> Manual -> Frontend -> Dev render screenshots
- Modal toggles visibility -> Manual -> Frontend -> Dev render screenshots
- Copy registry compliance -> Manual -> Frontend -> Visual scan + copy.csv validation

## Environments
- Local dashboard dev (`npm --prefix dashboard run dev`).

## Automation Plan
- No automated tests added in this change.

## Entry / Exit Criteria
- Entry:
  - OpenSpec proposal approved.
- Exit:
  - Manual render verification performed.
  - Copy registry validation passes.

## Coverage Risks
- Lack of automated UI tests could miss regressions when integrating into pages later.
