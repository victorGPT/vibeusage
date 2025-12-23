# Spec Delta: vibescore-tracker

## ADDED Requirements
### Requirement: Dashboard surfaces timezone basis for usage data
The dashboard SHALL display the timezone basis (UTC or local) used by usage aggregates, and MUST keep the label consistent with the parameters sent to usage endpoints.

#### Scenario: User sees timezone basis label
- **GIVEN** the dashboard requests usage data with or without `tz`/`tz_offset_minutes`
- **WHEN** the user views the usage panels
- **THEN** the UI SHALL show a visible label indicating the aggregate timezone basis
