# Acceptance Criteria

## Feature: Usage model breakdown endpoint

### Requirement: Provide per-source, per-model aggregates for a date range
- Rationale: The dashboard needs a stable data source for model distribution and cost analysis.

#### Scenario: Breakdown response shape
- WHEN a signed-in user calls `GET /functions/vibescore-usage-model-breakdown?from=2025-12-01&to=2025-12-07`
- THEN the response SHALL include `from`, `to`, `days`, and a `sources` array
- AND each `sources[]` entry SHALL include `source`, `totals` (including `total_cost_usd`), and `models[]`
- AND each `models[]` entry SHALL include `model` and token totals as strings, plus `total_cost_usd`
- AND the response SHALL include `pricing` metadata

### Requirement: Optional source filter limits results
- Rationale: The UI can scope breakdowns by ingestion source.

#### Scenario: Source filter
- WHEN a signed-in user calls `GET /functions/vibescore-usage-model-breakdown?from=2025-12-01&to=2025-12-07&source=codex`
- THEN the response SHALL include only `source = "codex"` groups

### Requirement: Missing model values are normalized to `unknown`
- Rationale: The UI must show a stable label for missing model data.

#### Scenario: Unknown model normalization
- GIVEN at least one hourly row has a null or empty `model`
- WHEN the user calls `GET /functions/vibescore-usage-model-breakdown`
- THEN the response SHALL include `model = "unknown"` for those rows
