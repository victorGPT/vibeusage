## MODIFIED Requirements
### Requirement: Dashboard TREND truncates at "now" without compressing the axis
The dashboard TREND chart SHALL keep the full local period axis (day/week/month), but SHALL stop plotting the trend line at the last elapsed local bucket. Future buckets MUST NOT render as zero values or placeholders, and the line MUST NOT extend into future buckets.

#### Scenario: Current date does not cover full period
- **GIVEN** the current local date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last elapsed local bucket
- **AND** the x-axis SHALL still span the full period range
- **AND** future buckets SHALL NOT render as zero-value points or placeholders

#### Scenario: Unsynced buckets show missing markers
- **GIVEN** hourly data includes `missing: true` for recent hours
- **WHEN** the dashboard renders the day trend
- **THEN** it SHALL render missing markers (no line) for those hours
- **AND** it SHALL keep zero-usage buckets (`missing=false`) on the line

## ADDED Requirements
### Requirement: Dashboard DETAILS hides future rows
The dashboard DETAILS table SHALL NOT display rows for future local dates, even if the value is zero or missing.

#### Scenario: Future daily rows are not shown
- **GIVEN** the current local date is before the end of the selected period
- **WHEN** the DETAILS table renders daily rows
- **THEN** rows with dates after today SHALL NOT be rendered
