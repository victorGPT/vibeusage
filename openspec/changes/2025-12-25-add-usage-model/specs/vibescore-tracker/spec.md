## ADDED Requirements
### Requirement: Half-hour buckets include model dimension
The system SHALL include a `model` field in half-hour aggregates and persist it as part of the bucket identity.

#### Scenario: Model-specific upsert key
- **WHEN** a bucket is uploaded with `source = "claude"` and `model = "claude-3-5-sonnet"`
- **THEN** the backend SHALL upsert using `user_id + device_id + source + model + hour_start` as the uniqueness key

### Requirement: Claude parser captures model from JSONL
The system SHALL extract `message.model` from Claude JSONL and attach it to the corresponding half-hour buckets.

#### Scenario: Claude model is captured
- **GIVEN** a Claude JSONL record includes `message.model = "moonshotai/Kimi-K2-Thinking"`
- **WHEN** `sync` parses the record
- **THEN** the queued bucket SHALL include `model = "moonshotai/Kimi-K2-Thinking"`

### Requirement: Missing model uses fallback
The system SHALL set `model = "unknown"` when a bucket is produced without a model.

#### Scenario: Missing model defaults to fallback
- **GIVEN** a bucket does not include `model`
- **WHEN** it is queued for upload
- **THEN** the queued bucket SHALL set `model = "unknown"`

### Requirement: Model normalization is trim-only
The system SHALL normalize `model` by trimming leading/trailing whitespace and preserve case.

#### Scenario: Model trimming preserves case
- **GIVEN** a bucket includes `model = "  MoonshotAI/Kimi-K2-Thinking  "`
- **WHEN** it is queued for upload
- **THEN** the queued bucket SHALL set `model = "MoonshotAI/Kimi-K2-Thinking"`

### Requirement: Backfill legacy rows to unknown
The system SHALL backfill historical rows by setting missing or empty `model` values to `unknown`, and the column SHALL be non-nullable.

#### Scenario: Migration normalizes legacy rows
- **WHEN** the migration is applied
- **THEN** rows with missing or empty `model` SHALL be updated to `model = "unknown"`
- **AND** the `model` column SHALL be non-nullable

### Requirement: Usage endpoints accept optional model filter
The usage endpoints SHALL accept an optional `model` query parameter to filter results; omitting `model` SHALL aggregate across models.

#### Scenario: Model filter returns only matching rows
- **WHEN** a user requests `GET /functions/vibescore-usage-daily?model=claude-3-5-sonnet`
- **THEN** only rows with `model = "claude-3-5-sonnet"` SHALL be included
- **AND** omitting `model` SHALL return aggregated results across models
