## ADDED Requirements
### Requirement: Hourly usage aggregation prefers DB-side grouping
The system SHALL attempt database-side hourly aggregation for `GET /functions/vibescore-usage-hourly` when the request uses UTC time, and SHALL fall back to row-level aggregation if the database aggregation is unavailable.

#### Scenario: DB aggregation succeeds
- **WHEN** a signed-in user requests hourly usage in UTC
- **THEN** the endpoint SHALL return hourly buckets aggregated by database-side grouping
- **AND** the response payload shape SHALL remain unchanged

#### Scenario: DB aggregation unsupported
- **WHEN** the database aggregation attempt fails
- **THEN** the endpoint SHALL fall back to the legacy aggregation path without changing response fields
