# Change: Add Claude Code usage ingestion (hooks + parser)

## Why

We need automatic usage ingestion for Claude Code, analogous to Codex notify, using user-level hooks and incremental parsing of Claude JSONL logs.

## What Changes

- Configure Claude Code `SessionEnd` hook in user-level `~/.claude/settings.json` to trigger the tracker notify handler.
- Parse Claude JSONL usage under `~/.claude/projects/**/*.jsonl` and aggregate into UTC half-hour buckets with `source = "claude"`.
- Surface Claude hook status in CLI status/diagnostics.
- Add unit tests for Claude parser and hook install/uninstall behavior.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `src/commands/init.js`, `src/commands/uninstall.js`, `src/commands/sync.js`, `src/commands/status.js`, `src/lib/diagnostics.js`, `src/lib/rollout.js`, `src/lib/claude-config.js`, tests.
