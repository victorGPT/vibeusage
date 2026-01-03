## 1. Spec
- [x] Add Linux CLI support and `CLAUDE_HOME` override requirements to the spec delta.

## 2. Implementation
- [x] Resolve Claude base directory from `CLAUDE_HOME` (fallback `~/.claude`) in init/status/uninstall/diagnostics/sync.
- [x] Clarify Linux support matrix and source coverage in CLI output/help where relevant.
- [x] Update docs: `README.md`, `README.zh-CN.md`, `openspec/project.md`, platform badge/description.

## 3. Tests
- [x] Add unit tests for `CLAUDE_HOME` path resolution (status/diagnostics/init/uninstall).
- [x] Add sync coverage test ensuring Linux path overrides parse Codex + Claude only.

## 4. Verification
- [x] `node --test test/init-uninstall.test.js test/status.test.js test/diagnostics.test.js test/claude-home-sync.test.js`
- [x] `npm test`
- [x] `VIBESCORE_RUN_NPX=1 node scripts/acceptance/npm-install-smoke.cjs`
- [ ] Manual: Linux (Ubuntu/Fedora/Arch) run `npx --yes @vibescore/tracker status` and `npx --yes @vibescore/tracker sync`.

## 5. Docs
- [x] Update `docs/deployment/freeze.md` when publishing the Linux-supporting CLI release.
