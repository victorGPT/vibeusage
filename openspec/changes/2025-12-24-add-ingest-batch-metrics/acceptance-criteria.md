# Acceptance Criteria

## Feature: ingest batch metrics

### Requirement: Metrics are recorded per ingest request
- Rationale: 提供可查询的请求级别负载证据。

#### Scenario: successful ingest logs metrics
- **GIVEN** a valid device token and a payload with 300 buckets
- **WHEN** the client calls `POST /functions/vibescore-ingest`
- **THEN** a metrics row SHALL be recorded with `bucket_count=300`
- **AND** it SHALL include `source`, `device_id`, `user_id`, and `inserted/skipped`

#### Scenario: mixed sources are labeled
- **GIVEN** a payload containing buckets from multiple sources
- **WHEN** the ingest request succeeds
- **THEN** the metrics row SHALL store `source = "mixed"`

### Requirement: Metrics are best-effort and non-blocking
- Rationale: 不影响现有 ingest 成功路径。

#### Scenario: metrics insert failure does not fail ingest
- **GIVEN** the metrics insert path returns an error
- **WHEN** the ingest request succeeds
- **THEN** the response SHALL still return `success: true`

### Requirement: Metrics retention is capped
- Rationale: 避免指标表无限增长。

#### Scenario: retention purges old metrics
- **GIVEN** metrics rows older than 30 days exist
- **WHEN** the retention job runs
- **THEN** those rows SHALL be removed
