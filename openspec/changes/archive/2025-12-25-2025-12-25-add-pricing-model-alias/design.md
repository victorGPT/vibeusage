## Context
- Usage model identifiers may not match OpenRouter model IDs.
- Pricing must remain auditable and reproducible.

## Goals / Non-Goals
- Goals:
  - Add alias mapping for usage -> pricing model.
  - Freeze alias decisions with `effective_from`.
  - Generate aliases during pricing sync using vendor rules.
- Non-Goals:
  - UI for alias management.
  - Expanding vendor rules beyond `claude-*` and `gpt-*` without explicit approval.

## Decisions
- Decision: Alias table is the source of mapping truth.
- Decision: Alias lookup runs before suffix matching.
- Decision: Vendor rules pick latest OpenRouter model using `created` field.

## Risks / Trade-offs
- Incorrect vendor inference -> mispricing; mitigate via explicit alias records and limited rules.

## Migration Plan
- Create alias table and policies.
- Deploy resolver update and sync changes.
- Backfill aliases for existing usage models via sync.

## Open Questions
- None.
