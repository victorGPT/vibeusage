## ADDED Requirements
### Requirement: Multi-source usage ingestion
The system SHALL accept an optional `source` field on half-hour bucket uploads. When `source` is missing or empty, the system SHALL default it to `codex` to preserve backward compatibility.

#### Scenario: Old client upload without source
- **GIVEN** a client uploads half-hour buckets without a `source`
- **WHEN** the ingest endpoint processes the payload
- **THEN** the stored rows SHALL use `source = "codex"`
- **AND** existing behavior SHALL remain unchanged

#### Scenario: New client upload with source
- **GIVEN** a client uploads half-hour buckets with `source = "every-code"`
- **WHEN** the ingest endpoint processes the payload
- **THEN** the stored rows SHALL use `source = "every-code"`

### Requirement: Multi-source deduplication
The system SHALL include `source` in the ingest deduplication key for half-hour buckets.

#### Scenario: Same hour across different sources
- **GIVEN** two uploads with the same `user_id`, `device_id`, and `hour_start`, but different `source`
- **WHEN** both are ingested
- **THEN** both rows SHALL be stored without collision

### Requirement: Usage queries support source filtering
Usage query endpoints SHALL accept an optional `source` filter. When omitted, the response SHALL aggregate across all sources to preserve current behavior.

#### Scenario: Query without source
- **WHEN** a user calls `GET /functions/vibescore-usage-daily` without `source`
- **THEN** the response SHALL include totals aggregated across all sources

#### Scenario: Query with source
- **WHEN** a user calls `GET /functions/vibescore-usage-daily?source=every-code`
- **THEN** the response SHALL include only rows from `source = "every-code"`
