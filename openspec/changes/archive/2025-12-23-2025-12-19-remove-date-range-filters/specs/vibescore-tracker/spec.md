# Spec Delta: vibescore-tracker

## ADDED Requirements

### Requirement: Dashboard does not support custom date filters
The dashboard UI MUST NOT provide arbitrary date range inputs. It SHALL only allow selecting a fixed `period` of `day`, `week` (Sunday start, UTC), `month`, or `total`.

#### Scenario: User can only switch predefined periods
- **GIVEN** the user is signed in
- **WHEN** the user views the dashboard query controls
- **THEN** the UI SHALL NOT present any `from/to` date picker inputs
- **AND** the UI SHALL allow selecting only `day|week|month|total`

