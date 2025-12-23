## ADDED Requirements
### Requirement: Leaderboard fallback query SHALL apply limit at source
The system SHALL apply the requested `limit` when querying the leaderboard view in the non-snapshot fallback path, so only the top N rows are fetched.

#### Scenario: Limit enforced at query
- **WHEN** a user requests `GET /functions/vibescore-leaderboard?limit=20`
- **THEN** the backend SHALL query only the top 20 leaderboard rows
- **AND** the response payload SHALL remain unchanged
