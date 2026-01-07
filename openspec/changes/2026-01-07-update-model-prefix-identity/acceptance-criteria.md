# Acceptance Criteria

## Feature: Model prefix identity & strict filtering

### Requirement: Preserve full usage model identity
- Rationale: 供应商差异可能影响效果与成本，不能被隐式合并。

#### Scenario: Prefixed usage model is retained
- GIVEN a half-hour bucket with `model = "aws/gpt-4o"`
- WHEN the bucket is ingested and later queried
- THEN the stored usage model SHALL remain `"aws/gpt-4o"` (lowercased, no prefix stripping)

### Requirement: Model filter is strict by default
- Rationale: 保持语义单一，避免隐式合并。

#### Scenario: Strict filter excludes other prefixed models
- GIVEN hourly rows include `model = "aws/gpt-4o"` and `model = "openai/gpt-4o"`
- WHEN a client calls `GET /functions/vibeusage-usage-daily?model=aws/gpt-4o`
- THEN only rows with `model = "aws/gpt-4o"` SHALL be included

#### Scenario: Alias expansion is explicit only
- GIVEN an active alias mapping `aws/gpt-4o -> gpt-4o`
- WHEN a client calls `GET /functions/vibeusage-usage-daily?model=gpt-4o`
- THEN rows for `aws/gpt-4o` SHALL be included
- AND no other prefixed models SHALL be included unless explicitly aliased

### Requirement: Pricing aliases are explicit
- Rationale: 价格不可反向驱动模型身份。

#### Scenario: Prefixed model without pricing alias uses default profile
- GIVEN usage model `aws/gpt-4o` has no active pricing alias row
- WHEN the pricing resolver computes costs
- THEN it SHALL fall back to the default pricing profile
- AND it SHALL NOT infer a pricing model by suffix match

#### Scenario: Prefixed model with explicit pricing alias uses alias model
- GIVEN an active pricing alias `aws/gpt-4o -> gpt-4o` for `pricing_source=openrouter`
- WHEN the pricing resolver computes costs
- THEN it SHALL use `gpt-4o` pricing for `aws/gpt-4o`
