# Spec Delta: vibescore-tracker

## ADDED Requirements

### Requirement: Dashboard UI is retro-TUI themed (visual only)
The Dashboard UI SHALL look like a retro TUI while preserving standard web interaction patterns (mouse clicks, form inputs, link navigation).

#### Scenario: Dashboard shows a terminal-like frame
- **WHEN** a user opens the dashboard home page
- **THEN** the UI SHALL present a terminal-like frame (header + bordered panels + status/help line)
- **AND** primary actions (sign-in, sign-up, refresh) SHALL remain clickable

### Requirement: Reduced-motion users are respected
The Dashboard UI MUST honor `prefers-reduced-motion` by disabling flicker-like or continuous animations.

#### Scenario: Reduced-motion disables CRT animations
- **GIVEN** the user has enabled reduced motion in their OS/browser
- **WHEN** they open the dashboard
- **THEN** CRT-like animations (if any) SHALL be disabled automatically

### Requirement: Connect CLI page matches the theme
The `/connect` page SHALL share the same retro-TUI theme as the main dashboard.

#### Scenario: Connect CLI page is themed
- **WHEN** a user opens `/connect`
- **THEN** the page SHALL use the same retro-TUI theme as the dashboard home page
