## ADDED Requirements
### Requirement: Ingest handles duplicate-heavy batches efficiently
The system SHALL ingest batches idempotently using a bulk write that ignores duplicate `event_id` entries, and MUST avoid per-row inserts in the normal duplicate replay case.

#### Scenario: Duplicate replay succeeds without errors
- **GIVEN** a batch containing duplicate `event_id` values
- **WHEN** the client calls `POST /functions/vibescore-ingest` with up to 500 events
- **THEN** the response SHALL be `200` with `inserted` and `skipped` counts
- **AND** the ingest path SHALL NOT fail due to duplicate conflicts

### Requirement: CLI applies backpressure on ingest failures
The CLI MUST respect server-provided backoff signals and apply exponential backoff on retryable failures to avoid burst traffic.

#### Scenario: Retry-After is honored
- **GIVEN** ingest responds with `503` and `Retry-After: 60`
- **WHEN** auto sync runs again
- **THEN** the next upload attempt SHALL be delayed by at least 60 seconds

### Requirement: Dashboard backend probe is low-frequency and passive
The dashboard SHALL rate-limit backend status probes and pause polling when the page is hidden.

#### Scenario: Hidden tab stops probing
- **GIVEN** the dashboard tab is hidden
- **WHEN** the page remains hidden for two intervals
- **THEN** no backend probe requests SHALL be issued until the tab becomes visible
