# Change: Add Gemini CLI usage ingestion (session JSON parser)

## Why
We need to capture Gemini CLI token usage and model identifiers locally, so usage metrics remain complete alongside Codex, Every Code, and Claude sources.

## What Changes
- Parse Gemini CLI session JSON files under `~/.gemini/tmp/**/chats/session-*.json`.
- Extract only token usage numbers and model identifiers, ignoring any content fields.
- Aggregate token usage into UTC half-hour buckets with `source = "gemini"`.
- Integrate Gemini parsing into `tracker sync` with idempotent cursors.
- Add unit tests for Gemini parsing and idempotent delta handling.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/commands/sync.js`, `src/lib/rollout.js`, tests.
