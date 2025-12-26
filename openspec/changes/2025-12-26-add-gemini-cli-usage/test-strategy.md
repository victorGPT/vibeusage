# Test Strategy

## Unit
- Gemini session parser aggregates `messages[].tokens` into UTC half-hour buckets with `source = "gemini"`.
- Token mapping follows `input/cached/output+tool/thoughts/total`.
- Model extraction uses `messages[].model` and falls back to `unknown`.
- Parser ignores `messages[].content` and does not persist it.
- Idempotency: repeated parse with identical totals yields no new deltas.
- Inode reset: cursor reset when session file is replaced.

## Integration
- `tracker sync` picks up Gemini session files alongside Codex/Every Code/Claude sources and queues buckets.

## Regression
- Re-run existing parser tests to ensure Codex/Claude/Every Code remain unaffected.
