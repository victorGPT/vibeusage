## ADDED Requirements

### Requirement: Model identity resolution is decoupled from pricing
The system SHALL resolve usage `model` values through a dedicated identity alias table (`vibescore_model_aliases`) and MUST NOT depend on `pricing_source` for identity mapping.

#### Scenario: Cross-CLI alias merge
- **GIVEN** `vibescore_model_aliases` maps `gpt-4o-mini` to `gpt-4o`
- **WHEN** usage rows contain both `gpt-4o-mini` and `gpt-4o`
- **THEN** aggregated outputs SHALL group them under a single `model_id = "gpt-4o"`

### Requirement: Usage APIs return canonical identity fields
The system SHALL return `model_id` (canonical) and `model` (display name) on all usage endpoints that expose model context.

#### Scenario: Breakdown response includes identity fields
- **WHEN** a signed-in user calls `GET /functions/vibeusage-usage-model-breakdown`
- **THEN** each model entry SHALL include `model_id`
- **AND** `model` SHALL be the display name (fallback to raw when missing)

### Requirement: Canonical model filtering
When a `model` query parameter is supplied, the system SHALL interpret it as a canonical model identifier and include all usage rows that map to it.

#### Scenario: Canonical filter includes alias rows
- **GIVEN** alias rows map `gpt-4o-mini` -> `gpt-4o`
- **WHEN** a user calls `GET /functions/vibeusage-usage-daily?...&model=gpt-4o`
- **THEN** rows for both `gpt-4o` and `gpt-4o-mini` SHALL be included

### Requirement: Fallback when alias is missing
If no alias mapping exists, the system SHALL use the raw usage model as both `model_id` and `model`.

#### Scenario: Unknown model fallback
- **GIVEN** `usage_model = "custom-model"` has no alias row
- **WHEN** a usage endpoint returns results
- **THEN** `model_id` and `model` SHALL both be `"custom-model"`
