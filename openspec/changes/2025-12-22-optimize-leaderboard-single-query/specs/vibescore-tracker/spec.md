## ADDED Requirements
### Requirement: Leaderboard fallback SHOULD use single query when possible
The system SHALL attempt a single-query fallback to fetch both Top N entries and the current user's row, and SHALL fall back to the legacy double-query flow if the single query fails.

#### Scenario: Single query succeeds
- **WHEN** a signed-in user requests the leaderboard
- **THEN** the backend SHALL fetch rows matching `rank <= limit OR is_me = true` in one query
- **AND** the response payload SHALL remain unchanged

#### Scenario: Single query fails
- **WHEN** the single-query attempt fails
- **THEN** the backend SHALL fall back to the legacy `entries + me` queries
