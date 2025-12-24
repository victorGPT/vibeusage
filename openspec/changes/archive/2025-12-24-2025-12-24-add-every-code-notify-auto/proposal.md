# Change: Auto-configure Every Code notify when config exists

## Why
- Every Code users currently need to manually set `notify` in `~/.code/config.toml` to trigger auto sync.
- We want auto sync to work out-of-the-box without modifying the Every Code client.

## What Changes
- `init` auto-configures Every Code `notify` **only when** `~/.code/config.toml` (or `CODE_HOME`) exists.
- The original Every Code `notify` is preserved (chained) and restorable on `uninstall`.
- The notify handler accepts a `--source=every-code` flag to chain the correct original notify.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/commands/init.js`, `src/commands/uninstall.js`, `src/lib/codex-config.js` (or a new notify-config helper), notify handler template
- **BREAKING**: none

## Architecture / Flow
- `init` checks `CODE_HOME` (default `~/.code`) for `config.toml`.
- If present, it writes `notify = ["/usr/bin/env", "node", "~/.vibescore/bin/notify.cjs", "--source=every-code"]`.
- The handler uses the `--source` flag to chain the matching original notify (Codex vs Every Code).

## Risks & Mitigations
- Risk: clobber user notify settings → Mitigation: preserve original notify, create backups, restore on uninstall.
- Risk: missing config file → Mitigation: skip auto-config (do not create `~/.code/config.toml`).
- Risk: handler recursion → Mitigation: detect and skip self-chaining.

## Rollout / Milestones
- M1: OpenSpec change drafted and validated
- M2: Implementation + tests (init/uninstall + handler)
- M3: Manual verification with a real Every Code session
