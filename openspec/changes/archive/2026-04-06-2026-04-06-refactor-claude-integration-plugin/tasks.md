## 1. Spec

- [x] Add a spec delta that redefines Claude integration as plugin-backed while preserving the existing notify and sync pipeline.

## 2. Implementation

- [x] Add a Claude plugin manager that generates a local marketplace and plugin source under the tracker directory.
- [x] Update Claude integration probe/install/uninstall to use official `claude plugin` and `claude plugin marketplace` commands.
- [x] Preserve `notify.cjs` as the repo-owned local bridge and remove legacy VibeUsage Claude hooks only after successful plugin installation.
- [x] Rename CLI/diagnostics/doctor Claude status reporting from hook semantics to plugin semantics.

## 3. Tests

- [x] Add unit tests for Claude marketplace/plugin generation and plugin state probing.
- [x] Add integration tests for legacy hook migration to plugin-backed install and uninstall cleanup.
- [x] Add doctor/status regression coverage for the new Claude plugin diagnostics keys and labels.

## 4. Verification

- [x] `node --test test/claude-plugin.test.js test/status.test.js test/init-uninstall.test.js test/doctor.test.js`
- [x] `openspec validate 2026-04-06-refactor-claude-integration-plugin --strict`
