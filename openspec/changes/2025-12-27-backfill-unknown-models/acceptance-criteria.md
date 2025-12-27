# Acceptance Criteria

## Feature: Unknown model backfill within half-hour buckets

### Requirement: Unknown is reassigned when known models exist
- Rationale: minimize unknown without cross-file inference.

#### Scenario: Unknown backfill into dominant model
- WHEN a half-hour bucket contains unknown totals and at least one known model total
- THEN unknown totals SHALL be added to the dominant known model by total_tokens
- AND the unknown bucket SHALL NOT be queued

### Requirement: Unknown remains when no known models exist
- Rationale: avoid inventing a model where none is known.

#### Scenario: Unknown preserved
- WHEN a half-hour bucket contains only unknown totals
- THEN the queued bucket SHALL keep model = "unknown"

### Requirement: Known models remain separate
- Rationale: avoid losing multi-model detail.

#### Scenario: Known models are not merged
- WHEN two known models appear in the same half-hour bucket
- THEN each known model SHALL remain a separate queued bucket
- AND only unknown totals SHALL be reassigned

### Requirement: Dominant model tie-breaker is deterministic
- Rationale: ensure idempotent sync output.

#### Scenario: Tied dominant totals
- WHEN two known models have equal total_tokens in the same bucket
- THEN the selected dominant model SHALL be chosen by a stable lexicographic order
