## ADDED Requirements

### Requirement: Edge functions emit M1 structured logs
The system SHALL emit structured M1 logs for `vibescore-ingest`, `vibescore-device-token-issue`, and `vibescore-sync-ping`, including `request_id`, `function`, `stage`, `status`, `latency_ms`, `error_code`, `upstream_status`, and `upstream_latency_ms`. Logs MUST NOT include payload contents or PII.

#### Scenario: Ingest request produces M1 log
- **WHEN** a client calls `POST /functions/vibescore-ingest`
- **THEN** the function SHALL emit a structured log with the required M1 fields
- **AND** the log SHALL NOT include request payload data

### Requirement: Ingest concurrency guard returns 429
The ingest endpoint SHALL enforce a configurable max inflight concurrency limit and return `429` with `Retry-After` when the limit is exceeded.

#### Scenario: Over-limit ingest request
- **GIVEN** concurrent ingest requests exceed the configured limit
- **WHEN** a new request arrives
- **THEN** the response SHALL be `429` and include `Retry-After`

### Requirement: Canary ingest probe is safe
The system SHALL provide a canary ingest script that uses a dedicated device token and `source/model=canary` to avoid contaminating real usage data.

#### Scenario: Canary run is idempotent and isolated
- **WHEN** the canary script runs repeatedly
- **THEN** it SHALL only affect canary buckets
- **AND** it SHALL NOT modify real user usage totals

### Requirement: Usage endpoints exclude canary buckets by default
Usage endpoints SHALL exclude `source=model=canary` rows unless explicitly requested via `source=canary` or `model=canary`.

#### Scenario: Default usage queries ignore canary buckets
- **WHEN** a user calls a usage endpoint without `source=canary` or `model=canary`
- **THEN** canary buckets SHALL be excluded from aggregates
