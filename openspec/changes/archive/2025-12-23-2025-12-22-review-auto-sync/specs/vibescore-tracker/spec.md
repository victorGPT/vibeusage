# Spec Delta: vibescore-tracker

## ADDED Requirements
### Requirement: Auto sync health is diagnosable
The CLI SHALL expose sufficient diagnostics to determine whether auto sync is functioning, degraded, or failing.

#### Scenario: User validates auto sync health
- **WHEN** a user runs `npx @vibescore/tracker status --diagnostics`
- **THEN** the output SHALL include the latest notify timestamp, last notify-triggered sync timestamp, queue pending bytes, and upload throttle state
