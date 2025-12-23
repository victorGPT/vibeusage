## ADDED Requirements

### Requirement: Dashboard DETAILS table matches selected period granularity
The dashboard UI SHALL render the DETAILS table with a date/time column that matches the selected period.

#### Scenario: Day period shows hourly rows
- **WHEN** the user selects `day`
- **THEN** the DETAILS table SHALL render hourly buckets for that day

#### Scenario: Week or month period shows daily rows
- **WHEN** the user selects `week` or `month`
- **THEN** the DETAILS table SHALL render daily buckets for the selected range

#### Scenario: Total period shows monthly rows with pagination
- **WHEN** the user selects `total`
- **THEN** the DETAILS table SHALL render monthly buckets for the latest 24 months
- **AND** the table SHALL paginate at 12 months per page

### Requirement: Dashboard DETAILS sorting defaults to newest-first with active indicator
The dashboard UI SHALL default the DETAILS table date/time sorting to newest-first and SHALL show a sort indicator only on the active column.

#### Scenario: Default date sort is newest-first
- **GIVEN** the user opens the dashboard DETAILS table
- **THEN** the date/time column SHALL be sorted with the newest bucket first

#### Scenario: Sort indicators appear only on the active column
- **WHEN** the user views the DETAILS table header row
- **THEN** only the active column SHALL show a visible sort indicator
