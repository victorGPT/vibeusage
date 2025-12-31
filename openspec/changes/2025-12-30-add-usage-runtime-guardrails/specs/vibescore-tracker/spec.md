## ADDED Requirements

### Requirement: Usage day-range endpoints enforce maximum range
The system SHALL reject usage requests that exceed a maximum day range for `GET /functions/vibescore-usage-summary`, `GET /functions/vibescore-usage-daily`, and `GET /functions/vibescore-usage-model-breakdown`. The maximum day range SHALL default to 370 days and be configurable via `VIBESCORE_USAGE_MAX_DAYS`.

#### Scenario: Oversized range is rejected
- **WHEN** a client calls `GET /functions/vibescore-usage-summary?from=2024-01-01&to=2025-12-31`
- **THEN** the endpoint SHALL respond with `400`
- **AND** the response SHALL include the maximum allowed day range

#### Scenario: Valid range succeeds
- **WHEN** a client calls `GET /functions/vibescore-usage-daily?from=2025-01-05&to=2025-12-31`
- **THEN** the endpoint SHALL respond with `200`
- **AND** the response SHALL follow the existing contract

### Requirement: Usage endpoints emit slow-query logs
The system SHALL emit structured logs with `stage=slow_query` for usage endpoints when a query duration exceeds `VIBESCORE_SLOW_QUERY_MS` (default 2000ms). The log payload SHALL include `query_label`, `duration_ms`, and `row_count`.

#### Scenario: Slow query is logged
- **GIVEN** a usage endpoint query duration >= `VIBESCORE_SLOW_QUERY_MS`
- **WHEN** the request completes
- **THEN** a log entry SHALL be emitted with `stage=slow_query`
- **AND** the entry SHALL include `query_label`, `duration_ms`, and `row_count`
