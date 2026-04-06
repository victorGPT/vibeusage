# Acceptance Criteria

1. SessionEnd hook install is safe and reversible.
   - **WHEN** `tracker init` runs and `~/.claude/settings.json` exists
   - **THEN** a `SessionEnd` hook pointing to the tracker notify handler is added
   - **AND** existing hooks are preserved
   - **AND** `tracker uninstall` removes only the tracker hook

2. Claude JSONL usage is parsed into half-hour buckets.
   - **WHEN** a JSONL record includes `message.usage.input_tokens` (and optionally `output_tokens`)
   - **THEN** the bucket aggregates into UTC half-hour boundaries with `source = "claude"`

3. Missing output tokens are treated as zero.
   - **WHEN** `output_tokens` is missing
   - **THEN** `output_tokens = 0` and `total_tokens = input_tokens`

4. Model is captured or falls back to `unknown`.
   - **WHEN** `message.model` exists
   - **THEN** the bucket includes the trimmed model string
   - **WHEN** `message.model` is missing or empty
   - **THEN** the bucket sets `model = "unknown"`
