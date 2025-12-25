# Acceptance Criteria

## Feature: Usage model dimension

### Requirement: Ingest persists model per half-hour bucket
- Rationale: Support model-level usage analysis without mixing tokens across models.

#### Scenario: Model-specific buckets are stored
- WHEN the client uploads a half-hour bucket with `model = "claude-3-5-sonnet"`
- THEN the backend SHALL store the bucket with that model
- AND the upsert key SHALL include `user_id + device_id + source + model + hour_start`

### Requirement: Model filter is optional in usage endpoints
- Rationale: Preserve existing queries while enabling model-level slices.

#### Scenario: Query with model filter returns only that model
- WHEN the client calls a usage endpoint with `model=claude-3-5-sonnet`
- THEN only rows with `model = "claude-3-5-sonnet"` SHALL be included
- AND omitting `model` SHALL return aggregated results across models

### Requirement: Claude parser emits model with usage buckets
- Rationale: Claude JSONL includes `message.model` and should be captured for accurate attribution.

#### Scenario: Claude JSONL model is recorded
- WHEN a Claude JSONL record includes `message.model`
- THEN the corresponding bucket SHALL include `model = message.model`

### Requirement: Missing model uses fallback
- Rationale: Ensure idempotent ingestion even when model is absent.

#### Scenario: Missing model defaults to `unknown`
- WHEN a bucket is produced without a model
- THEN the client SHALL set `model = "unknown"`

### Requirement: Model normalization is trim-only
- Rationale: Preserve upstream model identifiers while avoiding empty or whitespace-only values.

#### Scenario: Model trimming preserves case
- WHEN a bucket is produced with `model = "  MoonshotAI/Kimi-K2-Thinking  "`
- THEN the system SHALL normalize it to `"MoonshotAI/Kimi-K2-Thinking"`
- AND the original casing SHALL be preserved

### Requirement: Backfill legacy rows to unknown
- Rationale: Ensure historical data is compatible with model-specific dedupe keys.

#### Scenario: Migration normalizes legacy rows
- WHEN the migration is applied
- THEN rows with missing or empty `model` SHALL be updated to `model = "unknown"`
- AND the `model` column SHALL be non-nullable
