# Acceptance Criteria

## Feature: Increase default usage max-day guardrail to 800 days

### Requirement: Default max-day range is 800
- Rationale: Ensure 24-month dashboard window succeeds without manual env override.

#### Scenario: 24-month window succeeds by default
- WHEN a client calls `GET /functions/vibescore-usage-summary?from=2024-02-01&to=2026-01-01`
- THEN the endpoint responds with HTTP 200
- AND the response shape matches existing contracts

#### Scenario: Oversized range is rejected by default
- WHEN a client calls `GET /functions/vibescore-usage-summary?from=2023-01-01&to=2026-01-01`
- THEN the endpoint responds with HTTP 400
- AND the response includes the max allowed day range

### Requirement: Env override remains authoritative
- Rationale: Operators must be able to lower limits when needed.

#### Scenario: Env override enforces a smaller cap
- GIVEN `VIBESCORE_USAGE_MAX_DAYS=30`
- WHEN a client calls `GET /functions/vibescore-usage-daily?from=2025-01-01&to=2025-02-15`
- THEN the endpoint responds with HTTP 400
