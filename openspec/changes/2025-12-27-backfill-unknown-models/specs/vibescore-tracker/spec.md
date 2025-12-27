## ADDED Requirements
### Requirement: Unknown model backfill within half-hour buckets
The system SHALL set `model = "unknown"` only when no known model exists within the same source + half-hour bucket; when any known model exists, the system SHALL reassign unknown totals to the dominant known model and SHALL NOT emit an unknown bucket for that half-hour. For `every-code`, if the bucket remains unknown after same-source backfill, the system SHALL attempt alignment to the nearest `codex` dominant model; if none exists, it SHALL keep `unknown`.

#### Scenario: Unknown preserved when no known model exists
- **GIVEN** a half-hour bucket contains only unknown totals
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the queued bucket SHALL set `model = "unknown"`

#### Scenario: Unknown reassigned to dominant known model
- **GIVEN** a half-hour bucket contains unknown totals and at least one known model
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** unknown totals SHALL be added to the dominant known model
- **AND** no unknown bucket SHALL be queued for that half-hour

#### Scenario: Unknown bucket is retracted when a known model appears later
- **GIVEN** a half-hour bucket was previously queued as `model = "unknown"`
- **AND** a later sync observes a known model in that same source + half-hour
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the `model = "unknown"` bucket for that half-hour SHALL be updated to zero totals

#### Scenario: Every Code aligns to nearest Codex model
- **GIVEN** an every-code half-hour bucket remains unknown after same-source backfill
- **AND** a codex half-hour bucket exists at the nearest time (past or future)
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the every-code bucket SHALL use the dominant known model from that codex bucket

#### Scenario: Every Code alignment retracts prior target on change
- **GIVEN** an every-code half-hour bucket was previously aligned to a codex model
- **AND** a later sync selects a different nearest codex model for that bucket
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the previously aligned model bucket SHALL be updated to zero totals
- **AND** the newly aligned model bucket SHALL be queued with the current totals

#### Scenario: Every Code alignment recomputes after codex-only updates
- **GIVEN** an every-code half-hour bucket is aligned to a codex model
- **AND** a later sync adds new codex buckets without new every-code events
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the every-code bucket SHALL be re-aligned to the nearest codex dominant model

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

### Requirement: Every Code alignment is deterministic
The system SHALL select the nearest `codex` bucket by absolute time distance; when distances are equal, it SHALL pick the earlier `hour_start`.

#### Scenario: Nearest codex bucket tie-breaker
- **GIVEN** two codex buckets are equally distant from an every-code bucket
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the earlier codex bucket SHALL be selected

#### Scenario: No codex known model available
- **GIVEN** the nearest codex bucket has no known model
- **WHEN** the user runs `npx @vibescore/tracker sync`
- **THEN** the every-code bucket SHALL keep `model = "unknown"`
