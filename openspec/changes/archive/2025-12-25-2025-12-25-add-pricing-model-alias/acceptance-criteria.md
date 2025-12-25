# Acceptance Criteria

## Feature: Pricing model alias mapping

### Requirement: Resolver uses alias mapping
- Rationale: Usage models must map to pricing models even when names differ.

#### Scenario: Alias hit overrides suffix matching
- GIVEN a usage model `claude-opus-4-5-20251101`
- AND alias maps to `anthropic/claude-opus-4.5`
- WHEN pricing is resolved
- THEN the pricing model SHALL be `anthropic/claude-opus-4.5`

### Requirement: Sync writes alias rows for unmatched usage models
- Rationale: Latest vendor models must be frozen for auditability.

#### Scenario: Unmatched usage model writes alias
- GIVEN a usage model `gpt-5.2-codex`
- AND OpenRouter latest `openai/*` model is `openai/gpt-5.2-codex`
- WHEN pricing sync runs
- THEN an alias row SHALL be upserted with `effective_from = today`

### Requirement: Alias is frozen by effective_from
- Rationale: Historical pricing must not drift.

#### Scenario: Alias respects effective_from
- GIVEN alias rows with different `effective_from` dates
- WHEN resolver uses a date in the past
- THEN it SHALL select the latest alias row not in the future
