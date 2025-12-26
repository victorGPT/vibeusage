# Requirements Analysis

## Goal
Enable Gemini CLI usage capture by parsing session JSON logs and aggregating token usage into UTC half-hour buckets with model attribution.

## Actors
- CLI user (local)
- Gemini CLI (writes session JSON)
- VibeScore tracker CLI

## Constraints
- Only numeric token usage fields may be read and persisted; no prompt/response content.
- Aggregation uses UTC half-hour buckets and remains idempotent across repeated syncs.
- Model must be captured when present; otherwise fall back to `unknown`.
- Parser must tolerate partial or missing fields without crashing.

## Out of Scope
- Real-time streaming or daemon processes.
- Per-message attribution beyond half-hour aggregates.
- Any dashboard/UI changes.
