# Change: Add Linux CLI support (Codex + Claude Code)

## Why
We need official Linux support for the CLI on mainstream distributions, while keeping the npx-only distribution model and the current privacy guarantees.

## What Changes
- Declare Linux support (Ubuntu/Fedora/Arch) for CLI commands via npx, limited to Codex CLI and Claude Code sources.
- Add a Claude home override (`CLAUDE_HOME`) so hook configuration and log parsing can be redirected on Linux.
- Update platform docs and support matrix to reflect Linux coverage and source scope.
- Add tests that validate Linux path overrides and source coverage behavior.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/commands/init.js`, `src/commands/sync.js`, `src/commands/status.js`, `src/commands/uninstall.js`, `src/lib/claude-config.js`, `src/lib/diagnostics.js`, `src/lib/rollout.js`, `README.md`, `README.zh-CN.md`, `openspec/project.md`, tests.
