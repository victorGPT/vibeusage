## ADDED Requirements
### Requirement: Dashboard shows data source indicator
The dashboard SHALL display a data source label (`edge|cache|mock`) for usage and activity panels so users can distinguish live data from cached or mocked data.

#### Scenario: Mock mode is explicit
- **GIVEN** mock mode is enabled via `VITE_VIBESCORE_MOCK=1` or `?mock=1`
- **WHEN** the dashboard renders
- **THEN** the UI SHALL show `DATA_SOURCE: MOCK`

#### Scenario: Cache fallback is explicit
- **GIVEN** the user is signed in and cached data is used due to a fetch failure
- **WHEN** the dashboard renders usage or heatmap panels
- **THEN** the UI SHALL show `DATA_SOURCE: CACHE`

#### Scenario: Live data is explicit
- **GIVEN** the user is signed in and backend requests succeed
- **WHEN** the dashboard renders usage or heatmap panels
- **THEN** the UI SHALL show `DATA_SOURCE: EDGE`
