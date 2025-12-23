## ADDED Requirements
### Requirement: Dashboard landing page Lighthouse performance (desktop)
The dashboard landing page at `http://localhost:5173/` SHALL achieve a Lighthouse Performance score of at least 95 on desktop, measured as the median of three runs using the default Lighthouse desktop preset.

#### Scenario: Desktop Lighthouse audit on landing page (local)
- **WHEN** Lighthouse is run three times with the default desktop preset against `http://localhost:5173/`
- **THEN** the median Performance score SHALL be ≥ 95

### Requirement: Signed-in dashboard Lighthouse performance (desktop)
The signed-in dashboard at `http://localhost:5173/` SHALL achieve a Lighthouse Performance score of at least 95 on desktop, measured as the median of three runs using the default Lighthouse desktop preset in an authenticated or mock session.

#### Scenario: Desktop Lighthouse audit on signed-in dashboard (local)
- **GIVEN** a valid authenticated session is present in the browser storage OR mock mode is enabled with `?mock=1`
- **WHEN** Lighthouse is run three times with the default desktop preset against `http://localhost:5173/`
- **THEN** the median Performance score SHALL be ≥ 95
