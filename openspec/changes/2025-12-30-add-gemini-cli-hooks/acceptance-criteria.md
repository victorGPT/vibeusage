# Acceptance Criteria

## Feature: Gemini CLI SessionEnd hook integration

### Requirement: SessionEnd hook install is safe and idempotent
- Rationale: ensure auto sync triggers on Gemini sessions without breaking existing hooks.

#### Scenario: Existing SessionEnd hooks are preserved
- WHEN `tracker init` runs and Gemini `settings.json` exists with other `SessionEnd` hooks
- THEN the tracker hook is added with `type = "command"` and `name = "vibescore-tracker"`
- AND the command uses `notify.cjs --source=gemini`
- AND the hook matcher targets all `SessionEnd` reasons (`exit`, `clear`, `logout`, `prompt_input_exit`, `other`)
- AND `hooks.disabled` remains unchanged
- AND existing hooks remain unchanged

### Requirement: Hooks are enabled for execution
- Rationale: ensure Gemini CLI executes configured hooks.

#### Scenario: Enable hooks when disabled or missing
- WHEN `tracker init` runs and `tools.enableHooks` is `false` or missing
- THEN `tools.enableHooks` is set to `true`

### Requirement: Uninstall removes only tracker hook
- Rationale: avoid clobbering user configuration.

#### Scenario: Other hooks remain after uninstall
- WHEN `tracker uninstall` runs
- THEN the tracker hook is removed
- AND other `SessionEnd` hooks remain

### Requirement: Missing Gemini config is skipped safely
- Rationale: avoid creating unexpected config for users without Gemini CLI.

#### Scenario: Settings file missing
- WHEN `tracker init` runs and the Gemini config directory is missing
- THEN Gemini hook install is skipped and init continues
- AND no new Gemini config files are created

#### Scenario: Settings file absent but config directory exists
- WHEN `tracker init` runs and the Gemini config directory exists but `settings.json` is missing
- THEN a new `settings.json` is created with the tracker hook

### Requirement: Notify handler treats gemini as non-chained source
- Rationale: avoid invoking unrelated Codex/Every Code notify commands.

#### Scenario: Gemini notify invocation
- WHEN the notify handler runs with `--source=gemini`
- THEN it does not chain Codex/Every Code notify
- AND it exits `0` after spawning `sync --auto`

### Requirement: Status and diagnostics expose Gemini hook state
- Rationale: support debugging and supportability.

#### Scenario: Status reflects gemini hook
- WHEN `tracker status` runs
- THEN output includes Gemini hook `set`/`unset`
- AND diagnostics include the Gemini config path and configured flag
