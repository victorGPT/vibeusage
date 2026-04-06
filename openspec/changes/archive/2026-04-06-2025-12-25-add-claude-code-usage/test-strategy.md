# Test Strategy

## Unit

- `parseClaudeIncremental` aggregates usage into half-hour buckets.
- Model extraction and default `unknown` behavior.

## Integration

- `init` adds Claude SessionEnd hook without removing existing hooks.
- `uninstall` removes only tracker hook.

## Regression

- Existing Codex/Every Code parsing and notify behavior unaffected.

## Manual (Optional)

- Run `tracker init --no-auth --no-open`, end a Claude session, and confirm `queue.jsonl` grows, then `tracker sync --auto` uploads.
