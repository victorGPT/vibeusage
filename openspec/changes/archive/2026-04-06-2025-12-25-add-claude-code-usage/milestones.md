# Milestones

## M1: Hook management

- **Entry:** `claude-config` helper implemented.
- **Exit:** `init` installs hook, `uninstall` removes only tracker hook.
- **Artifact:** `src/lib/claude-config.js` and tests.

## M2: Parser + buckets

- **Entry:** Claude JSONL parser implemented.
- **Exit:** Half-hour buckets queued with `source=claude` and model handling.
- **Artifact:** `src/lib/rollout.js` parser tests.

## M3: CLI integration + verification

- **Entry:** `sync` runs Claude parser and queue.
- **Exit:** CLI tests pass and verification recorded.
- **Artifact:** `verification-report.md`.
