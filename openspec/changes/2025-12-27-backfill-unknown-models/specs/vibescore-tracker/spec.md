## MODIFIED Requirements
### Requirement: Missing model uses fallback
The system SHALL set `model = "unknown"` only when no known model exists within the same source + half-hour bucket; when any known model exists, the system SHALL reassign unknown totals to the dominant known model and SHALL NOT emit an unknown bucket for that half-hour.

#### Scenario: Unknown preserved when no known model exists
- **GIVEN** a half-hour bucket contains only unknown totals
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the queued bucket SHALL set `model = "unknown"`

#### Scenario: Unknown reassigned to dominant known model
- **GIVEN** a half-hour bucket contains unknown totals and at least one known model
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** unknown totals SHALL be added to the dominant known model
- **AND** no unknown bucket SHALL be queued for that half-hour

## ADDED Requirements
### Requirement: Known models remain separate during unknown backfill
The system SHALL NOT merge known models when reassigning unknown totals.

#### Scenario: Multiple known models remain separate
- **GIVEN** a half-hour bucket contains `model = "gpt-5.2"` and `model = "gpt-5.2-codex"`
- **AND** the same bucket includes unknown totals
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** each known model SHALL remain a separate queued bucket
- **AND** only unknown totals SHALL be reassigned to the dominant known model

### Requirement: Dominant model selection is deterministic
The system SHALL select the dominant known model by `total_tokens`, using a deterministic tie-breaker when totals are equal.

#### Scenario: Tied totals resolve deterministically
- **GIVEN** two known models have equal `total_tokens` within the same half-hour bucket
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the dominant model SHALL be selected by a stable lexicographic order
