## Context
Every Code supports `notify` via `~/.code/config.toml`. We already parse Every Code rollout logs, but auto sync only triggers if `notify` is configured. We need to auto-configure notify without creating new config files or breaking user settings.

## Goals / Non-Goals
- Goals:
  - Auto-configure Every Code `notify` when `config.toml` exists.
  - Preserve and restore existing Every Code `notify` on uninstall.
  - Use a source flag to chain the correct original notify.
- Non-Goals:
  - Creating `~/.code/config.toml` when missing.
  - Modifying the Every Code client or adding background services.

## Design
- Detect Every Code home via `CODE_HOME` or `~/.code`.
- If `config.toml` exists, write notify command with `--source=every-code`.
- Persist original notify in `~/.vibescore/tracker/code_notify_original.json`.
- Notify handler uses `--source` to select which original notify to chain and skips self-recursion.

## Open Questions
- None (payload format is treated as opaque; only used for chaining).
