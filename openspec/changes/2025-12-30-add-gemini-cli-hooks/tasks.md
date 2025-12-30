## 1. Spec
- [x] Add Gemini SessionEnd hook requirements to the spec delta.

## 2. Implementation
- [x] Add Gemini hooks config helper (safe merge/remove, preserve `hooks.disabled`, command builder, stable hook name).
- [x] Update `init` to install Gemini hook when Gemini config exists (`GEMINI_HOME`).
- [x] Update `uninstall` to remove the Gemini hook only.
- [x] Update notify handler to treat `--source=gemini` as non-chained.
- [x] Update `status` and diagnostics to expose Gemini hook state.
- [x] Update install output to include Gemini hook status.

## 3. Tests
- [x] Unit: Gemini hook merge/remove preserves existing hooks.
- [x] Integration: init/uninstall manages Gemini hooks without clobbering.
- [x] Regression: existing hook paths (Codex/Every Code/Claude/Opencode) remain intact.

## 4. Verification
- [x] `node --test test/init-uninstall.test.js`
- [x] `node scripts/acceptance/gemini-hook-install.cjs`

## 5. PR Gate
- [ ] Freeze record entry added to `docs/deployment/freeze.md`.
