## ADDED Requirements
### Requirement: Trend monitor uses the v2 TUI layout
The dashboard SHALL render the Trend monitor using the provided v2 TUI layout, including axes, grid, scan sweep, and fixed time labels on the X-axis.

#### Scenario: Trend monitor renders with fixed X-axis labels
- **GIVEN** the user is signed in and viewing the dashboard
- **WHEN** the Trend monitor renders
- **THEN** the X-axis SHALL display `-24H/-18H/-12H/-6H/NOW`
- **AND** the Trend monitor SHALL render values derived from the same daily usage data slice

#### Scenario: Minimal display when no data
- **GIVEN** the user has no daily usage data for the selected period
- **WHEN** the dashboard renders the Trend monitor
- **THEN** the Trend monitor SHALL still render axes, grid, and labels with a flat signal

#### Scenario: Panel label uses trend naming
- **GIVEN** the dashboard renders the Trend monitor
- **WHEN** the user views the panel header
- **THEN** the label SHALL read `Trend`
