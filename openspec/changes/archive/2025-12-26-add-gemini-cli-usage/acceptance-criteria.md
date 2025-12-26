# Acceptance Criteria

1. Gemini session JSON is parsed into half-hour buckets.
   - **WHEN** a Gemini session JSON contains `messages[].tokens`
   - **THEN** token usage SHALL be aggregated into UTC half-hour buckets with `source = "gemini"`
   - **AND** no message content SHALL be persisted or uploaded

2. Token mapping follows the product allowlist.
   - **WHEN** `messages[].tokens` contains `input`, `cached`, `output`, `tool`, `thoughts`, `total`
   - **THEN** the bucket SHALL map:
     - `input_tokens = input`
     - `cached_input_tokens = cached`
     - `output_tokens = output + tool`
     - `reasoning_output_tokens = thoughts`
     - `total_tokens = total`

3. Model is captured or falls back to `unknown`.
   - **WHEN** `messages[].model` exists
   - **THEN** the bucket SHALL record the trimmed model string
   - **WHEN** `messages[].model` is missing or empty
   - **THEN** the bucket SHALL record `model = "unknown"`

4. Re-running sync is idempotent.
   - **GIVEN** a session file has already been parsed
   - **WHEN** `tracker sync` runs again without new usage
   - **THEN** no additional buckets SHALL be queued or uploaded
