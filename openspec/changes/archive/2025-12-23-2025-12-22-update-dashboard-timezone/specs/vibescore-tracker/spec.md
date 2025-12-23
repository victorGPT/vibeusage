## ADDED Requirements
### Requirement: Usage endpoints accept dashboard timezone
The system SHALL allow the dashboard to request usage aggregates in a specified timezone using `tz` (IANA) or `tz_offset_minutes` (fixed offset). When timezone parameters are omitted, usage endpoints SHALL default to UTC behavior.

#### Scenario: Dashboard requests local daily aggregates
- **GIVEN** a signed-in user
- **WHEN** the dashboard calls `GET /functions/vibescore-usage-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=America/Los_Angeles`
- **THEN** the response `day` keys SHALL align to the requested local calendar dates
- **AND** missing local days SHALL be represented as zero activity

## MODIFIED Requirements
### Requirement: Dashboard provides a GitHub-inspired activity heatmap
The dashboard UI SHALL render an activity heatmap derived from daily token usage in the dashboard's local timezone, inspired by GitHub contribution graphs.

#### Scenario: Heatmap is derived from local daily totals
- **GIVEN** the user is signed in and the dashboard provides timezone parameters
- **WHEN** the dashboard fetches daily totals for a rolling range (e.g., last 52 weeks)
- **THEN** the UI SHALL derive heatmap intensity levels (0..4) from `total_tokens` per local day
- **AND** missing days SHALL be treated as zero activity

### Requirement: Dashboard does not support custom date filters
The dashboard UI MUST NOT provide arbitrary date range inputs. It SHALL only allow selecting a fixed `period` of `day`, `week` (Monday start), `month`, or `total`, computed in the browser timezone.

#### Scenario: User can only switch predefined periods
- **GIVEN** the user is signed in
- **WHEN** the user views the dashboard query controls
- **THEN** the UI SHALL NOT present any `from/to` date picker inputs
- **AND** the UI SHALL allow selecting only `day|week|month|total`

### Requirement: Dashboard TREND truncates future buckets
The dashboard TREND chart SHALL NOT render the trend line into future buckets that have not occurred yet in the dashboard timezone, and SHALL visually distinguish "unsynced" buckets from true zero-usage buckets. When timezone parameters are omitted, the dashboard SHALL use UTC as the basis.

#### Scenario: Current date does not cover full period (dashboard timezone)
- **GIVEN** the current dashboard timezone date/time is within an active period (e.g., mid-week or mid-month)
- **WHEN** the dashboard renders the TREND chart for that period
- **THEN** the trend line SHALL render only through the last available bucket in that timezone
- **AND** future buckets SHALL remain without a line

#### Scenario: Unsynced buckets show missing markers
- **GIVEN** hourly data includes `missing: true` for recent hours in the dashboard timezone
- **WHEN** the dashboard renders the day trend
- **THEN** it SHALL render missing markers (no line) for those hours
- **AND** it SHALL keep zero-usage buckets (`missing=false`) on the line

### Requirement: Hourly usage marks unsynced buckets
The hourly usage endpoint SHALL mark buckets after the latest sync timestamp as `missing: true` so the UI can distinguish unsynced hours. When `tz` or `tz_offset_minutes` is provided, the `day` parameter SHALL be interpreted in that timezone; otherwise it SHALL default to UTC.

#### Scenario: Latest sync timestamp splits the local day
- **GIVEN** the user's latest sync is at `2025-12-22T12:30:00Z`
- **AND** the dashboard calls `GET /functions/vibescore-usage-hourly?day=2025-12-22&tz=America/Los_Angeles`
- **WHEN** the local day is rendered
- **THEN** buckets after the local hour containing the sync time SHALL include `missing: true`
- **AND** buckets at or before that local hour SHALL NOT be marked missing
