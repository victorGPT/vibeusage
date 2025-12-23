# Spec Delta: vibescore-tracker

## ADDED Requirements
### Requirement: Dashboard compositing effects are GPU-budgeted
The dashboard SHALL avoid `backdrop-filter` on large layout containers and SHALL limit heavy glow shadows to small accent elements, to reduce idle GPU spikes.

#### Scenario: Large containers avoid backdrop-filter
- **WHEN** the dashboard renders primary containers (e.g., `AsciiBox`, `SystemHeader`)
- **THEN** their computed `backdrop-filter` SHALL be `none`

#### Scenario: Accents keep limited glow
- **WHEN** the dashboard renders small accent elements (e.g., status badges)
- **THEN** subtle glow shadows MAY remain while large panels avoid heavy shadows

### Requirement: Matrix rain cost is further reduced
The Matrix rain animation SHALL reduce internal render scale and update rate while preserving full-screen coverage.

#### Scenario: Matrix rain uses reduced budget
- **WHEN** Matrix rain is visible
- **THEN** the internal render scale SHALL be `<= 0.5`
- **AND** the update rate SHALL be `<= 8 fps`
