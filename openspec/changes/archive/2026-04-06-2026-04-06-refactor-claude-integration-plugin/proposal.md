# Change: Refactor Claude integration to plugin-backed install

## Why

Claude Code now has a first-class plugin system. Our current Claude integration still patches user-level hooks directly in `~/.claude/settings.json`, which keeps the install path outside Claude's official integration model and spreads Claude integration state across ad hoc hook mutations.

## What Changes

- Replace direct Claude hook installation with a VibeUsage-managed local Claude marketplace + plugin, installed through the official `claude plugin` CLI.
- Preserve the current runtime chain: Claude `Stop`/`SessionEnd` events still call the repo-owned local `notify.cjs` bridge, and `sync --auto` still owns half-hour throttled upload behavior.
- Keep Claude token usage parsing sourced from `~/.claude/projects/**/*.jsonl`; plugin state is not a usage source of truth.
- Add one-time migration behavior: after plugin installation succeeds, remove legacy VibeUsage Claude hooks without touching unrelated user hooks.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `src/lib/integrations/claude.js`, new Claude plugin manager, `src/commands/status.js`, `src/commands/uninstall.js`, `src/lib/diagnostics.js`, `src/lib/doctor.js`, tests, and install docs.
