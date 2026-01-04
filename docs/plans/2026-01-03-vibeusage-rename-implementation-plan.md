# VibeUsage Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename all public identifiers to VibeUsage with a 90-day transparent compatibility layer.

**Architecture:** Introduce explicit naming/mapping for brand, env vars, API slugs, CLI aliases, and local storage paths. Keep old identifiers working via proxy/alias for 90 days, while writing to new sources of truth.

**Tech Stack:** Node.js CLI, Vite/React dashboard, InsForge Edge Functions (Deno), OpenSpec docs.

---

### Task 1: Establish naming map + compatibility helpers

**Files:**
- Create: `src/lib/branding.js`
- Modify: `src/lib/insforge.js`
- Modify: `src/lib/insforge-client.js`
- Modify: `src/lib/vibescore-api.js`
- Modify: `dashboard/src/lib/config.js`
- Modify: `dashboard/src/lib/auth-storage.js`
- Modify: `dashboard/src/lib/http-timeout.js`
- Modify: `dashboard/src/lib/mock-data.js`
- Modify: `dashboard/src/lib/vibescore-api.js`
- Test: `test/http-timeout.test.js`
- Test: `test/dashboard-function-path.test.js`

**Step 1: Write failing tests for env/slug compatibility**
```js
// add tests verifying new env vars + old env vars fallback
```

**Step 2: Run test to verify it fails**
Run: `node --test test/http-timeout.test.js test/dashboard-function-path.test.js`
Expected: FAIL due to missing `VIBEUSAGE_*` support or new slugs.

**Step 3: Implement naming map + compatibility**
```js
// src/lib/branding.js
module.exports = {
  brand: 'VibeUsage',
  domain: 'https://www.vibeusage.cc',
  legacyBrand: 'VibeScore',
  legacyDomain: 'https://www.vibescore.space'
};
```

**Step 4: Run tests to verify pass**
Run: `node --test test/http-timeout.test.js test/dashboard-function-path.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/branding.js src/lib/insforge.js src/lib/insforge-client.js src/lib/vibescore-api.js dashboard/src/lib/config.js dashboard/src/lib/auth-storage.js dashboard/src/lib/http-timeout.js dashboard/src/lib/mock-data.js dashboard/src/lib/vibescore-api.js test/http-timeout.test.js test/dashboard-function-path.test.js
git commit -m "feat: add VibeUsage naming and compatibility map"
```

---

### Task 2: CLI rename + local storage migration (90-day compatibility)

**Files:**
- Modify: `bin/tracker.js`
- Modify: `src/cli.js`
- Modify: `src/commands/init.js`
- Modify: `src/commands/sync.js`
- Modify: `src/commands/status.js`
- Modify: `src/commands/uninstall.js`
- Modify: `src/lib/diagnostics.js`
- Modify: `scripts/dev-bin-shim.cjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/init-dry-run.test.js`
- Test: `test/init-flow-copy.test.js`
- Test: `test/init-uninstall.test.js`
- Test: `test/status.test.js`
- Test: `test/diagnostics.test.js`

**Step 1: Add failing tests for migration + new CLI names**
```js
// add tests for ~/.vibeusage migration + new command strings
```

**Step 2: Run tests to verify they fail**
Run: `node --test test/init-dry-run.test.js test/init-flow-copy.test.js test/init-uninstall.test.js test/status.test.js test/diagnostics.test.js`
Expected: FAIL.

**Step 3: Implement CLI rename + migration**
- Add new bin name `vibeusage` in `package.json` while keeping legacy aliases.
- Migrate local dir from `~/.vibescore` to `~/.vibeusage` (idempotent, read-old/write-new).
- Update CLI help and output strings to VibeUsage.

**Step 4: Run tests**
Run: `node --test test/init-dry-run.test.js test/init-flow-copy.test.js test/init-uninstall.test.js test/status.test.js test/diagnostics.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add bin/tracker.js src/cli.js src/commands/init.js src/commands/sync.js src/commands/status.js src/commands/uninstall.js src/lib/diagnostics.js scripts/dev-bin-shim.cjs package.json package-lock.json test/init-dry-run.test.js test/init-flow-copy.test.js test/init-uninstall.test.js test/status.test.js test/diagnostics.test.js
git commit -m "feat: rename CLI to VibeUsage with migration"
```

---

### Task 3: API path rename + compatibility proxy

**Files:**
- Modify: `insforge-src/functions/vibescore-*.js`
- Create: `insforge-src/functions/vibeusage-*.js`
- Modify: `insforge-src/shared/pricing.js`
- Modify: `insforge-src/shared/date.js`
- Modify: `insforge-src/shared/logging.js`
- Modify: `insforge-src/shared/usage-rollup.js`
- Modify: `insforge-functions/*.js` (generated)
- Modify: `scripts/build-insforge-functions.cjs`
- Test: `test/edge-functions.test.js`
- Test: `test/insforge-src-shared.test.js`

**Step 1: Add failing tests for new slugs**
```js
// ensure new /functions/vibeusage-* routes map to same handlers
```

**Step 2: Run tests to verify failure**
Run: `node --test test/edge-functions.test.js test/insforge-src-shared.test.js`
Expected: FAIL.

**Step 3: Implement proxy/rename**
- New `vibeusage-*` functions call existing logic.
- Legacy `vibescore-*` functions proxy to new implementations (transparent).
- Keep DB table names as-is for now.
- Rebuild generated functions.

**Step 4: Run tests**
Run: `npm run build:insforge && node --test test/edge-functions.test.js test/insforge-src-shared.test.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add insforge-src insforge-functions scripts/build-insforge-functions.cjs test/edge-functions.test.js test/insforge-src-shared.test.js
git commit -m "feat: add vibeusage edge paths with legacy proxy"
```

---

### Task 4: Dashboard branding + copy registry updates

**Files:**
- Modify: `dashboard/src/content/copy.csv`
- Modify: `dashboard/src/pages/LandingPage.jsx`
- Modify: `dashboard/src/pages/DashboardPage.jsx`
- Modify: `dashboard/src/lib/vibescore-api.js`
- Modify: `dashboard/src/hooks/use-usage-data.js`
- Modify: `dashboard/src/hooks/use-usage-model-breakdown.js`
- Modify: `dashboard/src/hooks/use-activity-heatmap.js`
- Modify: `dashboard/src/hooks/use-trend-data.js`
- Modify: `dashboard/src/hooks/use-backend-status.js`
- Modify: `dashboard/src/ui/matrix-a/components/UpgradeAlertModal.jsx`
- Modify: `dashboard/src/ui/matrix-a/components/GithubStar.jsx`
- Modify: `dashboard/vite.config.js`
- Modify: `dashboard/index.html`
- Modify: `dashboard/share.html`
- Modify: `dashboard/wrapped-2025.html`
- Modify: `dashboard/public/robots.txt`
- Modify: `dashboard/public/sitemap.xml`
- Modify: `dashboard/package.json`
- Modify: `dashboard/package-lock.json`
- Test: `test/dashboard-function-path.test.js`
- Test: `test/landing-screenshot.test.js`
- Test: `test/dashboard-session-expired-banner.test.js`

**Step 1: Update copy registry entries to VibeUsage**
Run: `node scripts/copy-sync.cjs pull --dry-run`
Edit: `dashboard/src/content/copy.csv` (install commands + branding text)
Run: `node scripts/validate-copy-registry.cjs`

**Step 2: Run tests**
Run: `node --test test/dashboard-function-path.test.js test/landing-screenshot.test.js test/dashboard-session-expired-banner.test.js`
Expected: PASS.

**Step 3: Commit**
```bash
git add dashboard/src/content/copy.csv dashboard/src/pages/LandingPage.jsx dashboard/src/pages/DashboardPage.jsx dashboard/src/lib/vibescore-api.js dashboard/src/hooks/use-usage-data.js dashboard/src/hooks/use-usage-model-breakdown.js dashboard/src/hooks/use-activity-heatmap.js dashboard/src/hooks/use-trend-data.js dashboard/src/hooks/use-backend-status.js dashboard/src/ui/matrix-a/components/UpgradeAlertModal.jsx dashboard/src/ui/matrix-a/components/GithubStar.jsx dashboard/vite.config.js dashboard/index.html dashboard/share.html dashboard/wrapped-2025.html dashboard/public/robots.txt dashboard/public/sitemap.xml dashboard/package.json dashboard/package-lock.json test/dashboard-function-path.test.js test/landing-screenshot.test.js test/dashboard-session-expired-banner.test.js
git commit -m "feat: update dashboard branding to VibeUsage"
```

---

### Task 5: Docs, scripts, and public artifacts

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `BACKEND_API.md`
- Modify: `docs/dashboard/api.md`
- Modify: `docs/ops/backfill-codex-unknown.md`
- Modify: `docs/ops/pricing-sync-health.md`
- Modify: `docs/diagrams/cli-init-flow.d2`
- Modify: `docs/diagrams/cli-init-flow.svg` (regenerate)
- Modify: `docs/deployment/freeze.md`
- Modify: `CHANGELOG.md`
- Modify: `openspec/project.md`
- Modify: `openspec/specs/vibescore-tracker/spec.md`
- Modify: `interaction_sequence.canvas`
- Modify: `architecture.canvas`
- Modify: `scripts/ops/interaction-sequence-canvas.cjs`
- Modify: `scripts/acceptance/*.cjs`
- Modify: `scripts/ops/*.sql`

**Step 1: Update docs + scripts**
- Replace public-facing strings and examples with VibeUsage.
- Preserve historical context where required but ensure user-facing instructions use VibeUsage.

**Step 2: Regenerate canvases**
Run: `node scripts/ops/architecture-canvas.cjs`
Run: `node scripts/ops/interaction-sequence-canvas.cjs`

**Step 3: Commit**
```bash
git add README.md README.zh-CN.md BACKEND_API.md docs/dashboard/api.md docs/ops/backfill-codex-unknown.md docs/ops/pricing-sync-health.md docs/diagrams/cli-init-flow.d2 docs/diagrams/cli-init-flow.svg docs/deployment/freeze.md CHANGELOG.md openspec/project.md openspec/specs/vibescore-tracker/spec.md interaction_sequence.canvas architecture.canvas scripts/ops/interaction-sequence-canvas.cjs scripts/acceptance scripts/ops
git commit -m "docs: align public docs and scripts with VibeUsage"
```

---

### Task 6: Verification + OpenSpec updates

**Files:**
- Modify: `openspec/changes/2026-01-03-rename-vibeusage/tasks.md`
- Modify: `openspec/changes/2026-01-03-rename-vibeusage/verification-report.md`

**Step 1: Run full test suite**
Run: `npm test`
Expected: PASS.

**Step 2: Manual verification**
- CLI alias checks (`vibeusage`, legacy commands).
- Old vs new API path response equality.
- Local migration idempotency.

**Step 3: Update OpenSpec checklists**
- Mark tasks complete and record commands/results.

**Step 4: Commit**
```bash
git add openspec/changes/2026-01-03-rename-vibeusage/tasks.md openspec/changes/2026-01-03-rename-vibeusage/verification-report.md
git commit -m "chore: record VibeUsage rename verification"
```
