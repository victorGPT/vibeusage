## ADDED Requirements
### Requirement: User JWT validation uses anon key
The system SHALL validate user JWTs using the project anon key so that user-authenticated endpoints (usage/leaderboard) return data when a valid token is provided.

#### Scenario: Valid user token returns usage data
- **GIVEN** a valid user JWT
- **WHEN** the user calls `GET /functions/vibescore-usage-summary`
- **THEN** the response SHALL be `200` with a JSON payload
