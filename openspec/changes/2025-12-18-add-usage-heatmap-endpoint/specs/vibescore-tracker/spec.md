# Spec Delta: vibescore-tracker

## ADDED Requirements

### Requirement: Usage heatmap endpoint is available
The system SHALL provide a heatmap endpoint that returns a GitHub-inspired activity heatmap derived from UTC daily token usage for the authenticated user.

#### Scenario: User fetches a 52-week heatmap
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-usage-heatmap?weeks=52`
- **THEN** the response SHALL include a `weeks` grid with intensity `level` values in the range `0..4`
- **AND** missing days SHALL be treated as zero activity

### Requirement: Heatmap endpoint enforces safe limits
The heatmap endpoint MUST validate inputs and enforce reasonable limits to avoid excessive range queries.

#### Scenario: Invalid parameters are rejected
- **WHEN** a user calls `GET /functions/vibescore-usage-heatmap` with an invalid `to` date or an out-of-range `weeks` value
- **THEN** the endpoint SHALL respond with `400`

