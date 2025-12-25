## ADDED Requirements
### Requirement: Usage model breakdown endpoint
The system SHALL provide a `GET /functions/vibescore-usage-model-breakdown` endpoint that returns per-source and per-model aggregates derived from half-hour buckets for the requested date range.

#### Scenario: Breakdown response includes grouped totals
- **WHEN** a signed-in user calls `GET /functions/vibescore-usage-model-breakdown?from=2025-12-01&to=2025-12-07`
- **THEN** the response SHALL include a `sources` array
- **AND** each entry SHALL include `source`, `totals` (including `total_cost_usd`), and `models[]`
- **AND** each model entry SHALL include `model` and token totals as strings, plus `total_cost_usd`

### Requirement: Model breakdown honors source filter
The endpoint SHALL accept an optional `source` query parameter and limit results to that source when provided.

#### Scenario: Source filter limits groups
- **WHEN** a signed-in user calls `GET /functions/vibescore-usage-model-breakdown?from=2025-12-01&to=2025-12-07&source=codex`
- **THEN** the response SHALL include only `source = "codex"` groups

### Requirement: Model breakdown normalizes missing model to `unknown`
The endpoint SHALL represent missing or empty model values as `unknown` in the response.

#### Scenario: Unknown model normalization
- **GIVEN** a half-hour row has a null or empty `model`
- **WHEN** the user calls `GET /functions/vibescore-usage-model-breakdown`
- **THEN** the response SHALL include `model = "unknown"` for that aggregate

### Requirement: Model breakdown includes pricing metadata
The endpoint SHALL include pricing metadata consistent with `vibescore-usage-summary` so the UI can interpret cost estimates.

#### Scenario: Pricing metadata included
- **WHEN** a signed-in user calls `GET /functions/vibescore-usage-model-breakdown`
- **THEN** the response SHALL include a `pricing` object describing the pricing profile used
