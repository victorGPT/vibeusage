## ADDED Requirements

### Requirement: Ingest batch metrics are recorded
The system SHALL record a per-request ingest batch metrics row containing at least `bucket_count`, `inserted`, `skipped`, `source`, `device_id`, `user_id`, and `ingest_at` (or `created_at`), and MUST NOT include prompt/response content. If a single request includes multiple sources, the metrics `source` SHALL be recorded as `mixed`.

#### Scenario: Successful ingest logs metrics
- **GIVEN** a valid device token and a payload with 300 half-hour buckets
- **WHEN** the client calls `POST /functions/vibescore-ingest`
- **THEN** a metrics row SHALL be recorded with `bucket_count = 300`
- **AND** the row SHALL include `source`, `device_id`, `user_id`, and `inserted/skipped`

### Requirement: Ingest batch metrics are best-effort
The system SHALL treat metrics insertion as best-effort and MUST NOT fail a successful ingest response due to metrics write failures.

#### Scenario: Metrics insert failure does not fail ingest
- **GIVEN** the metrics insert path returns an error
- **WHEN** the ingest request otherwise succeeds
- **THEN** the response SHALL still return `success: true`

### Requirement: Ingest batch metrics retention is capped
The system SHALL purge ingest batch metrics older than 30 days.

#### Scenario: Retention job purges old metrics
- **GIVEN** metrics rows older than 30 days exist
- **WHEN** the retention job runs
- **THEN** those rows SHALL be removed
