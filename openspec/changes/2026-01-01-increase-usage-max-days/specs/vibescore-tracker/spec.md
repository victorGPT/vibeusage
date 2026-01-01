## MODIFIED Requirements

### Requirement: Usage day-range endpoints enforce maximum range
The system SHALL reject usage requests that exceed a maximum day range for `GET /functions/vibescore-usage-summary`, `GET /functions/vibescore-usage-daily`, and `GET /functions/vibescore-usage-model-breakdown`. The maximum day range SHALL default to 800 days and be configurable via `VIBESCORE_USAGE_MAX_DAYS`.

#### Scenario: 24-month window succeeds by default
- **WHEN** a client calls `GET /functions/vibescore-usage-summary?from=2024-02-01&to=2026-01-01`
- **THEN** the endpoint SHALL respond with `200`
- **AND** the response SHALL follow the existing contract

#### Scenario: Oversized range is rejected
- **WHEN** a client calls `GET /functions/vibescore-usage-summary?from=2023-01-01&to=2026-01-01`
- **THEN** the endpoint SHALL respond with `400`
- **AND** the response SHALL include the maximum allowed day range

#### Scenario: Env override enforces smaller cap
- **GIVEN** `VIBESCORE_USAGE_MAX_DAYS=30`
- **WHEN** a client calls `GET /functions/vibescore-usage-daily?from=2025-01-01&to=2025-02-15`
- **THEN** the endpoint SHALL respond with `400`
