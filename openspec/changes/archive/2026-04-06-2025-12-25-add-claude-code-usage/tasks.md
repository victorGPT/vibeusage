## 1. Spec

- [x] Add Claude Code hook + parser requirements to the spec delta.

## 2. Implementation

- [x] Add Claude hooks config helper (safe merge + remove).
- [x] Update `init` to install Claude `SessionEnd` hook (user-level).
- [x] Update `uninstall` to remove Claude hook only.
- [x] Extend notify handler to avoid chaining Codex notify on Claude source.
- [x] Add Claude JSONL parser and integrate into `sync`.
- [x] Expose Claude hook status in `status` and diagnostics.

## 3. Tests

- [x] Parser: Claude JSONL usage aggregates into half-hour buckets.
- [x] Init/uninstall: Claude hook added and removed while preserving existing settings.

## 4. Verification

- [x] `node --test test/rollout-parser.test.js test/init-uninstall.test.js`
- [x] Local smoke: run `node bin/tracker.js init --no-auth --no-open` then end a Claude session and confirm `queue.jsonl` grows, then `node bin/tracker.js sync --auto` uploads.
