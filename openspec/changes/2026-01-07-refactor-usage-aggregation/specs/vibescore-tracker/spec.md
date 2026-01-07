## ADDED Requirements

### Requirement: Usage aggregation rules are centralized
The system SHALL compute totals and billable totals using a shared aggregation rule across all usage endpoints to ensure consistent results.

#### Scenario: Consistent totals across endpoints
- **GIVEN** the same `from/to/source/model` inputs
- **WHEN** a user calls `GET /functions/vibeusage-usage-summary`, `GET /functions/vibeusage-usage-daily`, and `GET /functions/vibeusage-usage-model-breakdown`
- **THEN** summary totals SHALL equal the sum of daily totals
- **AND** summary totals SHALL equal the sum of model breakdown totals
