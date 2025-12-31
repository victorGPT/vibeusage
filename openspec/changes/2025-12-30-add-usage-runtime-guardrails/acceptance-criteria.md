# Acceptance Criteria

## Feature: Usage runtime guardrails and observability

### Requirement: Day-range usage endpoints enforce maximum range
- Rationale: Prevent unbounded scans that destabilize the edge runtime.

#### Scenario: Oversized range is rejected
- WHEN a client calls `GET /functions/vibescore-usage-summary?from=2024-01-01&to=2025-12-31`
- THEN the endpoint responds with HTTP 400
- AND the response includes an error message indicating the max allowed range in days

#### Scenario: Valid range succeeds
- WHEN a client calls `GET /functions/vibescore-usage-daily?from=2025-01-05&to=2025-12-31`
- THEN the endpoint responds with HTTP 200
- AND the response shape matches existing contracts

### Requirement: Slow queries emit structured logs
- Rationale: Identify runtime hotspots before they cause outages.

#### Scenario: Slow query is logged
- GIVEN a usage endpoint query duration >= `VIBESCORE_SLOW_QUERY_MS`
- WHEN the request completes
- THEN a log entry is emitted with `stage=slow_query`
- AND the entry includes `query_label`, `duration_ms`, and `row_count`

### Requirement: Heatmap limit validation remains enforced
- Rationale: Keep weekly range requests bounded.

#### Scenario: Out-of-range weeks are rejected
- WHEN a client calls `GET /functions/vibescore-usage-heatmap?weeks=999`
- THEN the endpoint responds with HTTP 400
