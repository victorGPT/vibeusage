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

### Requirement: Dashboard shows a boot screen (visual only)
The dashboard UI SHALL provide a short, visual-only boot screen inspired by `copy.jsx`, without requiring any backend data.

#### Scenario: Boot screen appears briefly
- **WHEN** a user opens the dashboard home page
- **THEN** the UI MAY show a boot screen briefly before the main dashboard renders
- **AND** the boot screen SHALL NOT block sign-in or data loading beyond a short, fixed delay

### Requirement: Dashboard provides a GitHub-inspired activity heatmap
The dashboard UI SHALL render an activity heatmap derived from daily token usage, inspired by GitHub contribution graphs.

#### Scenario: Heatmap is derived from UTC daily totals
- **GIVEN** the user is signed in
- **WHEN** the dashboard fetches daily totals for a rolling range (e.g., last 52 weeks)
- **THEN** the UI SHALL derive heatmap intensity levels (0..4) from `total_tokens` per UTC day
- **AND** missing days SHALL be treated as zero activity

### Requirement: Dashboard shows identity information from login state
The dashboard UI SHALL show an identity panel derived from the login state (name/email/userId). Rank MAY be shown as a placeholder until a backend rank endpoint exists.

#### Scenario: Identity panel uses auth fields
- **GIVEN** the user is signed in
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL display `name` when available, otherwise fall back to `email`
- **AND** it MAY display `userId` as a secondary identifier
