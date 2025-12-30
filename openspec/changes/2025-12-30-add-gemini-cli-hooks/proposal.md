# Change: Add Gemini CLI SessionEnd hook integration

## Why
- Gemini CLI sessions do not currently trigger VibeScore auto sync; usage depends on manual `sync`.
- Align Gemini with Codex/Claude/Opencode auto-upload behavior.

## What Changes
- Add Gemini hooks config helper to safely upsert/remove a `SessionEnd` command hook.
- Update `init` to install the Gemini hook when Gemini config exists.
- Update `uninstall` to remove only the tracker hook.
- Update notify handler to treat `--source=gemini` as non-chained.
- Surface Gemini hook status in `status` and diagnostics.
- Add tests and an acceptance script.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/lib/gemini-config.js`, `src/commands/init.js`, `src/commands/uninstall.js`, `src/commands/status.js`, `src/lib/diagnostics.js`, notify handler generator, tests.
- **BREAKING**: none

## Architecture / Flow
- User-level `settings.json` under `GEMINI_HOME` (default `~/.gemini`) is updated to include a `SessionEnd` command hook.
- Gemini CLI invokes the hook at session end; the notify handler spawns `sync --auto` and exits `0`.

## Risks & Mitigations
- Schema mismatch or disabled hooks -> detect missing config, skip install, and document manual sync.
- Hook clobbers existing entries -> merge and remove only the tracker hook; preserve other hooks.

## Rollout / Milestones
- See `openspec/changes/2025-12-30-add-gemini-cli-hooks/milestones.md`.
