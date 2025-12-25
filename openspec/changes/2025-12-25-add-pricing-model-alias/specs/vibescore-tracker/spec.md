## ADDED Requirements
### Requirement: Pricing model aliases are supported
The system SHALL support alias mappings from `usage_model` to `pricing_model` with an `effective_from` date and a `pricing_source`.

#### Scenario: Alias hit resolves pricing model
- **GIVEN** a usage model has an active alias mapping
- **WHEN** the pricing resolver runs
- **THEN** it SHALL use the alias `pricing_model` for pricing lookup

### Requirement: Alias mappings are frozen by effective_from
The system MUST select the latest alias mapping not in the future for a given usage model.

#### Scenario: Resolver selects latest effective alias
- **GIVEN** alias rows with different `effective_from` dates
- **WHEN** the resolver uses a date in the past
- **THEN** it SHALL select the latest alias row not in the future

### Requirement: Pricing sync writes alias rows for unmatched usage models
The pricing sync job SHALL generate alias rows for usage models that do not match any OpenRouter pricing model by exact or suffix match, using vendor rules and the latest OpenRouter model.

#### Scenario: Unmatched usage model is aliased
- **GIVEN** a usage model `claude-opus-4-5-20251101`
- **WHEN** pricing sync runs
- **THEN** an alias row SHALL be written mapping to the latest OpenRouter `anthropic/*` model
