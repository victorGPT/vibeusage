# Module Brief: Gemini CLI SessionEnd Hook

## Scope
- IN: user-level Gemini hooks config install/remove, SessionEnd trigger to notify handler, status/diagnostics reporting.
- OUT: Gemini log parsing (already implemented), project-level hook configs, daemon scheduling.

## Interfaces
- Input: Gemini `settings.json`, notify handler path, environment variables (`HOME`, `GEMINI_HOME`).
- Output: updated Gemini `settings.json`, CLI stdout lines, notify handler invocation.

## Data Flow and Constraints
- Gemini CLI fires `SessionEnd` hooks; we run `notify.cjs --source=gemini` (non-blocking).
- Hook entry is `command` type and named for enable/disable.
- Must preserve existing hooks; updates are idempotent; uninstall removes only our hook.
- `hooks.disabled` is preserved.
- `tools.enableHooks` is forced to `true` to ensure hooks execute.

## Non-Negotiables
- Do not block Gemini CLI (command must return quickly and exit `0`).
- Do not delete or overwrite unrelated hooks.
- Respect `GEMINI_HOME` when resolving config paths.
- Hook logic MUST NOT persist or upload content payloads.

## Test Strategy
- Unit: Gemini hook merge/remove behavior.
- Integration: init/uninstall in temp `HOME` with existing hooks.
- Regression: Codex/Every Code/Claude hook behavior unchanged; status/diagnostics stable.

## Milestones
- M1: Planning artifacts + spec delta approved.
- M2: Config helper + notify handler update.
- M3: CLI init/uninstall/status/diagnostics + tests.
- M4: Regression + acceptance script + PR gate evidence.

## Plan B Triggers
- If Gemini hook schema differs or rejects command hooks, fallback to skip install and document manual `sync` instructions.

## Upgrade Plan (disabled)
- Optional: add project-level `.gemini/settings.json` integration on demand.
