# Test Strategy

## Objectives
- Validate response shape, grouping correctness, and cost computation.
- Ensure source filtering and unknown model normalization.

## Test Levels
- Unit:
  - Grouping helper aggregates rows by `source` + `model`.
  - Cost computation per group uses pricing helper and returns strings.
- Integration:
  - Edge function returns expected JSON for a seeded range.
- Regression:
  - Repeatable script/runbook that calls the endpoint for a known fixture range and checks totals.
- Performance:
  - Sanity check large range (e.g., 365 days) to ensure pagination does not time out.

## Test Matrix
- Breakdown shape -> Integration -> Backend -> curl + JSON assertions
- Source filter -> Integration -> Backend -> curl + JSON assertions
- Unknown model -> Unit/Integration -> Backend -> fixture row

## Environments
- Local InsForge stack or staging with seeded hourly data.

## Automation Plan
- Add a lightweight node script or shell runbook under `scripts/` to call the endpoint and assert key fields.

## Entry / Exit Criteria
- Entry: OpenSpec proposal approved.
- Exit: Tests documented in verification report with pass evidence.

## Coverage Risks
- DB-side aggregation support may vary; fallback path must be validated.
