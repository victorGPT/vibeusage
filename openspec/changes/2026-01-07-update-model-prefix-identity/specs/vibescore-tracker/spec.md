## MODIFIED Requirements

### Requirement: Usage endpoints canonicalize model identity
Usage endpoints SHALL preserve full usage model identifiers (including vendor prefixes) with trim + lowercase normalization. Canonicalization MUST rely only on explicit alias mappings in `vibescore_model_aliases`; the `model` query parameter SHALL match a canonical id and expand only to active explicit aliases for the requested range. Responses that include model identity SHALL emit both `model_id` (canonical) and display `model`.

#### Scenario: Prefixed model is preserved without alias
- **GIVEN** hourly rows include `model = "aws/gpt-4o"` and no alias mapping exists
- **WHEN** a client calls `GET /functions/vibeusage-usage-model-breakdown`
- **THEN** the response SHALL include `model_id = "aws/gpt-4o"`
- **AND** the display `model` SHALL be `"aws/gpt-4o"`

#### Scenario: Strict filter excludes other prefixed models
- **GIVEN** hourly rows include `model = "aws/gpt-4o"` and `model = "openai/gpt-4o"`
- **WHEN** a client calls `GET /functions/vibeusage-usage-daily?model=aws/gpt-4o`
- **THEN** only rows with `model = "aws/gpt-4o"` SHALL be included

#### Scenario: Explicit alias expansion only
- **GIVEN** an active alias mapping `aws/gpt-4o -> gpt-4o`
- **WHEN** a client calls `GET /functions/vibeusage-usage-daily?model=gpt-4o`
- **THEN** usage from `aws/gpt-4o` SHALL be included
- **AND** other prefixed models SHALL NOT be included unless explicitly aliased

## ADDED Requirements

### Requirement: Prefixed models use explicit pricing aliases
Pricing resolution SHALL use explicit `vibescore_pricing_model_aliases` mappings for prefixed usage models. If no pricing alias exists, the resolver SHALL fall back to the default pricing profile and MUST NOT infer a pricing model by suffix matching.

#### Scenario: Prefixed model without alias falls back to default pricing
- **GIVEN** usage model `aws/gpt-4o` has no active pricing alias row
- **WHEN** the pricing resolver runs
- **THEN** it SHALL use the default pricing profile

#### Scenario: Prefixed model with explicit alias uses alias pricing
- **GIVEN** an active pricing alias `aws/gpt-4o -> gpt-4o` for `pricing_source=openrouter`
- **WHEN** the pricing resolver runs
- **THEN** it SHALL use `gpt-4o` pricing for `aws/gpt-4o`
