## ADDED Requirements

### Requirement: Hourly usage endpoint for day trend
The system SHALL provide an hourly usage endpoint that returns UTC 24-hour aggregates for a given day.

#### Scenario: User requests hourly usage for today
- **GIVEN** a signed-in user with a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-usage-hourly?day=YYYY-MM-DD`
- **THEN** the response SHALL include `day` and a `data` array with up to 24 hourly buckets in UTC
- **AND** each bucket SHALL include `total_tokens` (and related token fields) with bigints encoded as strings

### Requirement: Monthly usage endpoint for total trend
The system SHALL provide a monthly usage endpoint that returns the most recent 24 UTC months of aggregates.

#### Scenario: User requests recent 24 months
- **GIVEN** a signed-in user with a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-usage-monthly?months=24&to=YYYY-MM-DD`
- **THEN** the response SHALL include `from`, `to`, `months=24`, and a `data` array keyed by `month` (`YYYY-MM`)
- **AND** each month SHALL include `total_tokens` (and related token fields) with bigints encoded as strings

### Requirement: TREND chart uses period-aligned granularity
The dashboard TREND module SHALL use period-aligned aggregates: `day=hourly`, `week|month=daily`, `total=monthly(24)`.

#### Scenario: User switches periods on the dashboard
- **GIVEN** the user is signed in and views the dashboard
- **WHEN** the user switches between `day`, `week`, `month`, and `total`
- **THEN** the TREND chart SHALL request and render the corresponding aggregation granularity
- **AND** the X-axis labels SHALL align with the chosen period (hours for day, dates for week/month, months for total)

### Requirement: TREND chart truncates future buckets
The dashboard TREND module SHALL NOT render the trend line into future UTC buckets that have not occurred yet.

#### Scenario: Current date does not cover full period
- **GIVEN** the current UTC date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last available UTC bucket
- **AND** future buckets SHALL remain without a line
