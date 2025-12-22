## ADDED Requirements
### Requirement: Monthly usage aggregation prefers DB-side grouping
The system SHALL attempt database-side monthly aggregation for `GET /functions/vibescore-usage-monthly` when the request uses UTC time, and SHALL fall back to row-level aggregation if the database aggregation is unavailable.

#### Scenario: DB aggregation succeeds
- **WHEN** a signed-in user requests monthly usage in UTC
- **THEN** the endpoint SHALL return monthly buckets aggregated by database-side grouping
- **AND** the response payload shape SHALL remain unchanged

#### Scenario: DB aggregation unsupported
- **WHEN** the database aggregation attempt fails
- **THEN** the endpoint SHALL fall back to the legacy aggregation path without changing response fields
