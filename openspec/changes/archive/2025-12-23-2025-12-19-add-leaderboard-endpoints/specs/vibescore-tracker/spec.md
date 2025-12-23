# Spec Delta: vibescore-tracker

## ADDED Requirements

### Requirement: Leaderboard endpoint is available (calendar day/week/month/total)
The system SHALL provide a leaderboard endpoint that ranks users by `total_tokens` over a UTC calendar `day`, `week` (Sunday start), `month`, or `total` (all-time).

#### Scenario: User fetches the current weekly leaderboard
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `GET /functions/vibescore-leaderboard?period=week`
- **THEN** the response SHALL include `from` and `to` in `YYYY-MM-DD` (UTC)
- **AND** the response SHALL include an ordered `entries` array sorted by `total_tokens` (desc)

### Requirement: Leaderboard response includes `me`
The leaderboard endpoint SHALL include a `me` object that reports the current user's `rank` and `total_tokens`, even when the user is not present in the `entries` array.

#### Scenario: User is not in Top N but still receives `me`
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **AND** the user is not within the top requested `limit`
- **WHEN** the user calls `GET /functions/vibescore-leaderboard?period=week&limit=20`
- **THEN** the response SHALL include a `me` object with the user's `rank` and `total_tokens`

### Requirement: Leaderboard output is privacy-safe
The leaderboard endpoint MUST NOT expose PII (e.g., email) or any raw Codex logs. It SHALL only return publicly-safe profile fields and aggregated totals.

#### Scenario: Leaderboard never returns email or raw logs
- **WHEN** the user calls `GET /functions/vibescore-leaderboard`
- **THEN** the response SHALL NOT include any email fields
- **AND** the response SHALL NOT include any prompt/response/log content

### Requirement: Leaderboard is anonymous by default
Users SHALL be included in the leaderboard by default, but their identity MUST be anonymized unless they explicitly choose to make their leaderboard profile public.

#### Scenario: Default users appear as anonymous
- **GIVEN** a user has not enabled public leaderboard profile
- **WHEN** another signed-in user calls `GET /functions/vibescore-leaderboard`
- **THEN** the entry for that user SHALL have `display_name` set to a non-identifying value (e.g., `Anonymous`)
- **AND** `avatar_url` SHALL be `null`

### Requirement: Leaderboard enforces safe limits
The leaderboard endpoint MUST validate inputs and enforce reasonable limits to avoid excessive enumeration.

#### Scenario: Invalid parameters are rejected
- **WHEN** a user calls `GET /functions/vibescore-leaderboard?period=year`
- **THEN** the endpoint SHALL respond with `400`

### Requirement: Leaderboard privacy setting can be updated
The system SHALL provide an authenticated endpoint for the current user to update their leaderboard privacy preference.

#### Scenario: User sets leaderboard profile to public
- **GIVEN** a user is signed in and has a valid `user_jwt`
- **WHEN** the user calls `POST /functions/vibescore-leaderboard-settings` with body `{ "leaderboard_public": true }`
- **THEN** the response SHALL include `leaderboard_public: true`
