# Retrospective Index (L1 Cards)

Use this file as the first filter. Read full docs only when card fields match your task.

> Migration status: new retros should use repo-scoped layout (`retrospective/<repo>/...`).
> Legacy flat files remain readable but should be migrated incrementally when touched.

## Repo: vibeusage

- **2026-04-24 — Claude Usage Parser Severe Under-Counting**
  - path: `vibeusage/2026-04-24-claude-usage-parser-under-counting.md`
  - layer: `backend`
  - module: `claude-usage-parser`
  - severity: `S1`
  - design_mismatch: `yes`
  - detection_gap: `yes`
  - reusable_for: `usage-parser`, `claude-code-integration`, `opencode-integration`, `rollout-dedupe`, `token-accounting`, `backfill-upsert`
  - summary: Two independent parser bugs (cache_read dropped from total_tokens + same message.id double-counted) drove dashboard Claude totals to ~10% of reality; plugin-ization of the hook never touched the compute layer where the bugs lived. PR #152 + #153 fix it; local cursor scrub + sync --drain rewound historical buckets to the correct ~1.02x of local ground truth.

- **2026-03-30 — Insforge ESM Hard Cut Runtime Contract Mismatch**
  - path: `vibeusage/2026-03-30-insforge-esm-hard-cut-runtime-contract-mismatch.md`
  - layer: `backend`
  - module: `insforge-esm-runtime-contract`
  - severity: `S1`
  - design_mismatch: `yes`
  - detection_gap: `yes`
  - reusable_for: `insforge`, `edge-functions`, `esm-hard-cut`, `runtime-contract`, `release-provenance`, `deploy-smoke`
  - summary: The ESM hard cut was structurally correct, but we replaced the official SDK-import runtime contract with an unproven injected-global assumption and had to recover via live probes plus a merged-main redeploy.

- **2026-02-17 — Session Close Trigger Retrospective**
  - path: `vibeusage/2026-02-17-session-close-0023-1472963598577041574.md`
  - layer: `fullstack`
  - module: `session-close`
  - severity: `S3`
  - design_mismatch: `no`
  - detection_gap: `no`
  - reusable_for: `session-close`, `retrospective workflow`
  - summary: Discord thread close event triggered the session-end retrospective workflow and produced a lightweight closeout record.

- **2026-03-28 — Dashboard Display Model Prefix Regression**
  - path: `vibeusage/2026-03-28-dashboard-display-model-prefix-regression.md`
  - layer: `fullstack`
  - module: `dashboard-model-display`
  - severity: `S2`
  - design_mismatch: `yes`
  - detection_gap: `yes`
  - reusable_for: `dashboard`, `display-model`, `cache fallback`, `release verification`, `repo-sitemap`
  - summary: Backend and deploys were correct, but cache fallback and component-level raw-model fallback still leaked vendor-prefixed labels.

- **2026-02-14 — Leaderboard Public View Clickability + Mobile Landing Fallback**
  - path: `vibeusage/2026-02-14-leaderboard-public-view-clickability.md`
  - layer: `fullstack`
  - module: `leaderboard-public-view`
  - severity: `S2`
  - design_mismatch: `yes`
  - detection_gap: `yes`
  - reusable_for: `leaderboard`, `public share`, `mobile navigation`, `auth-gate`
  - summary: Replaced display-name inference with explicit `is_public` authorization and fixed mobile landing fallback caused by full-page navigation.

- **2026-02-14 — OpenClaw Usage Ingest Gap**
  - path: `vibeusage/2026-02-14-openclaw-ingest-gap.md`
  - layer: `backend`
  - module: `openclaw-sync`
  - severity: `S1`
  - design_mismatch: `yes`
  - detection_gap: `yes`
  - reusable_for: `ingest`, `hook lifecycle`, `sync diagnostics`, `backfill`
  - summary: Hook/upload looked healthy, but JSONL-first assumption broke; fallback+idempotency+backfill fixed missing `source=openclaw` usage.
