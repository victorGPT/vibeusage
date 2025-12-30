# Requirement Analysis

## Goal
- Enable Gemini CLI session end hooks to trigger VibeScore auto sync without manual commands, while preserving existing Gemini hooks.

## Scope
- In scope:
  - Configure Gemini CLI user-level hooks in `~/.gemini/settings.json` or `GEMINI_HOME`.
  - Install/remove a `SessionEnd` command hook that invokes `notify.cjs --source=gemini`.
  - Expose Gemini hook status in `status` and diagnostics.
  - Ensure notify handler does not chain Codex/Every Code when source is gemini.
- Out of scope:
  - Gemini session parsing (already implemented).
  - Daemon or scheduler changes.
  - Project-level `.gemini/settings.json` management.
  - Non-command hook types.

## Users / Actors
- CLI user
- Gemini CLI
- VibeScore tracker CLI
- Local file system

## Inputs
- `~/.gemini/settings.json` (or `GEMINI_HOME` override)
- Notify handler path `~/.vibescore/bin/notify.cjs`
- Environment variables: `GEMINI_HOME`, `HOME`

## Outputs
- Updated Gemini `settings.json` with `SessionEnd` hook entry
- CLI install/uninstall output and status/diagnostics flags

## Business Rules
- Hook install MUST preserve existing `SessionEnd` hooks.
- Uninstall MUST remove only the tracker hook.
- Hook command MUST be non-blocking and exit `0`.
- Hook MUST target `SessionEnd` and match all SessionEnd reasons (`exit`, `clear`, `logout`, `prompt_input_exit`, `other`).
- Hook entry MUST use `type = "command"` and include a stable `name` for `/hooks enable/disable`.
- `hooks.disabled` MUST be preserved and never overwritten.
- `tools.enableHooks` MUST be set to `true` even if previously `false`.

## Assumptions
- Gemini CLI reads hooks from user-level `settings.json` and executes command hooks on `SessionEnd`.
- Hook entries can be nested under a `hooks` array and filtered by `matcher` patterns.
- `GEMINI_HOME` (if set) points to the Gemini config root.

## Dependencies
- Gemini CLI hooks configuration schema and event names.
- Existing notify handler behavior and throttling.

## Risks
- Gemini CLI schema changes or hook disablement.
- Users without `~/.gemini` directory; hook install may be skipped.
- Hook command path becomes invalid if tracker install is moved or removed.
- Gemini hooks may be globally disabled via `tools.enableHooks = false`; hooks would not execute until user enables them.
