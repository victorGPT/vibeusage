# Spec Delta: vibescore-tracker

## MODIFIED Requirements

### Requirement: Dashboard UI is retro-TUI themed (visual only)
The Dashboard UI SHALL adopt the "Matrix UI A" visual system (based on `copy.jsx`) while preserving standard web interaction patterns (mouse clicks, form inputs, link navigation).

#### Scenario: Dashboard uses Matrix UI A components
- **WHEN** a user opens the dashboard home page
- **THEN** the UI SHALL be composed from reusable Matrix UI A components (e.g., framed boxes, compact data rows, trend charts)
- **AND** the underlying data flow (auth callback, usage queries) SHALL remain unchanged

### Requirement: Connect CLI page matches the theme
The `/connect` page SHALL share the same Matrix UI A theme and component system as the main dashboard.

#### Scenario: Connect CLI page uses Matrix UI A shell
- **WHEN** a user opens `/connect`
- **THEN** the page SHALL render in the same Matrix UI A visual system
- **AND** invalid redirect errors SHALL remain readable

## ADDED Requirements

### Requirement: UI and data logic are decoupled
The dashboard frontend MUST keep data logic decoupled from the UI layer so future theme swaps do not require touching auth/storage/fetch logic.

#### Scenario: UI components are props-driven
- **GIVEN** the dashboard renders a UI panel
- **THEN** UI components SHALL receive data via props/hooks outputs
- **AND** UI components SHALL NOT directly perform network requests or storage mutations

