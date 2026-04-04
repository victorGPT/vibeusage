# OpenClaw Sanitized Usage Ingress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace VibeUsage's OpenClaw transcript/fallback accounting with a single sanitized event-ledger path that never reads session content and never depends on OpenClaw core changes.

**Architecture:** The OpenClaw plugin becomes a usage-event emitter, not a transcript-sync hint. It records only whitelisted usage metadata into a VibeUsage-owned local ledger; `sync --from-openclaw` then reads that ledger, aggregates half-hour buckets, and uploads them using the existing `source = "openclaw"` contract.

**Tech Stack:** Node.js, OpenClaw plugin hooks, JSONL local ledgers/state files, VibeUsage CLI sync pipeline, Node test runner.

---

## Scope lock

- This plan supersedes `docs/superpowers/plans/2026-04-04-openclaw-usage-ssot.md` for OpenClaw accounting.
- Do not implement the Gateway `sessions.usage.logs` accounting path.
- Do not preserve transcript parsing, fallback totals, or `openclaw-legacy` as a compatibility layer.
- Do not add project attribution for OpenClaw in this change.

## File structure

**Create**
- `src/lib/openclaw-usage-ledger.js` — sanitized OpenClaw event ledger helpers (append, read, dedupe, cursor state).
- `test/openclaw-usage-ledger.test.js` — ledger schema, hashing, dedupe, forbidden-field coverage.
- `test/sync-openclaw-sanitized.test.js` — end-to-end sync coverage using sanitized ledger input only.
- `docs/openclaw-integration.md` — single-path OpenClaw integration contract.

**Modify**
- `src/lib/openclaw-session-plugin.js` — emit sanitized usage events from `llm_output`; stop emitting transcript/fallback hints.
- `src/commands/sync.js` — consume sanitized ledger; remove transcript/fallback OpenClaw accounting.
- `src/lib/integrations/index.js` — unregister `openclaw-legacy`.
- `src/lib/integrations/openclaw-session.js` — keep only supported OpenClaw session plugin behavior/copy.
- `src/commands/init.js` — install only the supported OpenClaw integration.
- `src/commands/status.js` — render only the supported OpenClaw integration.
- `src/commands/uninstall.js` — uninstall only the supported OpenClaw integration.
- `README.md` — align the OpenClaw architecture and privacy text.
- `test/openclaw-session-plugin.test.js` — plugin contract tests.
- `test/sync-openclaw-trigger.test.js` — remove fallback expectations; assert ledger-only flow.
- `test/subscriptions.test.js` / `test/install-status.test.js` / `test/init-uninstall.test.js` — operator-surface regression coverage.

**Delete**
- `src/lib/integrations/openclaw-legacy.js`
- OpenClaw transcript parsing functions in `src/lib/rollout.js` once no callers remain.
- OpenClaw fallback accounting path in `src/commands/sync.js`.

## Task 1: Freeze the contract in docs and tests

**Files:**
- Create: `docs/openclaw-integration.md`
- Modify: `README.md`
- Test: `test/openclaw-session-plugin.test.js`, `test/install-status.test.js`

- [ ] **Step 1: Write the failing documentation assertions**
  - Assert the docs say OpenClaw accounting uses a sanitized local ledger.
  - Assert the docs explicitly reject transcript parsing, Gateway log accounting, and fallback totals.
  - Assert the docs say VibeUsage does not read OpenClaw session content.

- [ ] **Step 2: Run targeted doc-adjacent regression coverage**

Run:
```bash
node --test test/openclaw-session-plugin.test.js test/install-status.test.js
```
Expected: existing tests still reference transcript/fallback/legacy behavior and will need updates.

- [ ] **Step 3: Write `docs/openclaw-integration.md`**
  - Document the single supported ingress.
  - Include allowed event fields and forbidden fields.
  - State that bucket upload remains unchanged.

- [ ] **Step 4: Update `README.md` OpenClaw sections**
  - Replace "Session plugin" wording that implies transcript-driven sync with sanitized-event wording.
  - Keep privacy promises aligned with the real contract.

- [ ] **Step 5: Commit**

```bash
git add docs/openclaw-integration.md README.md
 git commit -m "docs: freeze openclaw sanitized ingress contract"
```

## Task 2: Delete legacy and transcript/fallback accounting paths

**Files:**
- Modify: `src/lib/integrations/index.js`
- Delete: `src/lib/integrations/openclaw-legacy.js`
- Modify: `src/commands/sync.js`
- Modify/Delete: `src/lib/rollout.js`
- Test: `test/sync-openclaw-trigger.test.js`, `test/subscriptions.test.js`, `test/init-uninstall.test.js`

- [ ] **Step 1: Write failing tests for hard-cut behavior**
  - Status/install/uninstall must no longer mention `openclaw-legacy`.
  - `sync --from-openclaw` must no longer accept transcript/fallback accounting input.
  - No OpenClaw code path may resolve `~/.openclaw/agents/*/sessions/*.jsonl` for accounting.

- [ ] **Step 2: Run the focused suite and confirm it fails for the new contract**

Run:
```bash
node --test test/sync-openclaw-trigger.test.js test/subscriptions.test.js test/init-uninstall.test.js
```
Expected: failures due to legacy/fallback expectations still being present.

- [ ] **Step 3: Remove legacy registration and module**
  - Delete `src/lib/integrations/openclaw-legacy.js`.
  - Remove it from `src/lib/integrations/index.js`.

- [ ] **Step 4: Remove transcript parsing and fallback accounting**
  - Delete OpenClaw-specific parsing entrypoints from `src/lib/rollout.js`.
  - Delete `applyOpenclawTotalsFallback()` and the `VIBEUSAGE_OPENCLAW_PREV_*` accounting contract from `src/commands/sync.js`.

- [ ] **Step 5: Re-run the focused suite**

Run:
```bash
node --test test/sync-openclaw-trigger.test.js test/subscriptions.test.js test/init-uninstall.test.js
```
Expected: tests still fail until the sanitized ledger path lands, but no failures should depend on removed files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/index.js src/commands/sync.js src/lib/rollout.js test/sync-openclaw-trigger.test.js test/subscriptions.test.js test/init-uninstall.test.js
 git rm src/lib/integrations/openclaw-legacy.js
 git commit -m "refactor: remove old openclaw accounting paths"
```

## Task 3: Build the sanitized OpenClaw ledger

**Files:**
- Create: `src/lib/openclaw-usage-ledger.js`
- Create: `test/openclaw-usage-ledger.test.js`

- [ ] **Step 1: Write the failing ledger tests**
  - Appending an event persists only whitelisted fields.
  - Re-appending the same event does not create a duplicate accounting row.
  - `sessionRef` is hashed and raw `sessionKey` never appears in persisted output.
  - Raw `workspaceDir` and assistant content never appear in persisted output.

- [ ] **Step 2: Run the new ledger test file**

Run:
```bash
node --test test/openclaw-usage-ledger.test.js
```
Expected: FAIL because the ledger module does not exist yet.

- [ ] **Step 3: Implement the minimal ledger module**
  - Add append-only event persistence.
  - Add duplicate suppression state keyed by deterministic `eventId`.
  - Add a per-install salt and `sessionRef` hashing helper.
  - Add a ledger reader that yields sanitized events for sync.

- [ ] **Step 4: Re-run the ledger test file**

Run:
```bash
node --test test/openclaw-usage-ledger.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openclaw-usage-ledger.js test/openclaw-usage-ledger.test.js
 git commit -m "feat: add openclaw sanitized usage ledger"
```

## Task 4: Rewrite the OpenClaw plugin to emit sanitized usage events

**Files:**
- Modify: `src/lib/openclaw-session-plugin.js`
- Modify: `test/openclaw-session-plugin.test.js`

- [ ] **Step 1: Write failing plugin tests for the new event contract**
  - Plugin writes sanitized usage events from `llm_output`.
  - Plugin no longer emits transcript file references.
  - Plugin no longer emits `VIBEUSAGE_OPENCLAW_PREV_*` fallback fields.
  - Plugin ignores rich assistant content fields when constructing events.

- [ ] **Step 2: Run the plugin suite**

Run:
```bash
node --test test/openclaw-session-plugin.test.js
```
Expected: FAIL until the plugin is rewritten.

- [ ] **Step 3: Implement the plugin rewrite**
  - Build sanitized events from `llm_output` + safe context only.
  - Persist them through `src/lib/openclaw-usage-ledger.js`.
  - Keep install/remove mechanics stable for operators.

- [ ] **Step 4: Re-run the plugin suite**

Run:
```bash
node --test test/openclaw-session-plugin.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openclaw-session-plugin.js test/openclaw-session-plugin.test.js
 git commit -m "refactor: make openclaw plugin emit sanitized usage events"
```

## Task 5: Rewire sync to consume the sanitized ledger only

**Files:**
- Modify: `src/commands/sync.js`
- Create: `test/sync-openclaw-sanitized.test.js`
- Modify: `test/sync-openclaw-trigger.test.js`

- [ ] **Step 1: Write failing sync tests**
  - `sync --from-openclaw` reads only the sanitized ledger.
  - Repeated OpenClaw triggers are idempotent.
  - Aggregated buckets preserve `source = "openclaw"` and numeric usage totals.
  - No transcript/fallback path is touched.

- [ ] **Step 2: Run the focused sync suite**

Run:
```bash
node --test test/sync-openclaw-sanitized.test.js test/sync-openclaw-trigger.test.js
```
Expected: FAIL because `sync` still expects the old flow.

- [ ] **Step 3: Implement the sync rewrite**
  - Read sanitized events from the new ledger.
  - Aggregate them into the existing half-hour bucket model.
  - Persist ledger cursor/offset state inside VibeUsage local state.

- [ ] **Step 4: Re-run the focused sync suite**

Run:
```bash
node --test test/sync-openclaw-sanitized.test.js test/sync-openclaw-trigger.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/sync.js test/sync-openclaw-sanitized.test.js test/sync-openclaw-trigger.test.js
 git commit -m "refactor: make openclaw sync consume sanitized ledger"
```

## Task 6: Align operator UX and integration surfaces

**Files:**
- Modify: `src/commands/init.js`
- Modify: `src/commands/status.js`
- Modify: `src/commands/uninstall.js`
- Modify: `src/lib/integrations/openclaw-session.js`
- Test: `test/install-status.test.js`, `test/init-uninstall.test.js`, `test/subscriptions.test.js`

- [ ] **Step 1: Write or update failing UX regression tests**
  - Exactly one OpenClaw integration appears.
  - `init` installs the supported plugin only.
  - `uninstall` removes the supported plugin only.
  - Help/status copy does not mention fallback or legacy behavior.

- [ ] **Step 2: Run the UX regression suite**

Run:
```bash
node --test test/install-status.test.js test/init-uninstall.test.js test/subscriptions.test.js
```
Expected: FAIL until copy/behavior is aligned.

- [ ] **Step 3: Implement the UX cleanup**
  - Update the status copy.
  - Update init/uninstall result rendering.
  - Ensure subscriptions/integration discovery exposes only the supported OpenClaw path.

- [ ] **Step 4: Re-run the UX regression suite**

Run:
```bash
node --test test/install-status.test.js test/init-uninstall.test.js test/subscriptions.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.js src/commands/status.js src/commands/uninstall.js src/lib/integrations/openclaw-session.js test/install-status.test.js test/init-uninstall.test.js test/subscriptions.test.js
 git commit -m "docs: align openclaw operator ux with sanitized ingress"
```

## Task 7: Full verification and evidence capture

**Files:**
- Review: `src/lib/openclaw-usage-ledger.js`, `src/lib/openclaw-session-plugin.js`, `src/commands/sync.js`, `docs/openclaw-integration.md`

- [ ] **Step 1: Run the focused OpenClaw regression suite**

Run:
```bash
node --test test/openclaw-usage-ledger.test.js test/openclaw-session-plugin.test.js test/sync-openclaw-sanitized.test.js test/sync-openclaw-trigger.test.js test/install-status.test.js test/init-uninstall.test.js test/subscriptions.test.js
```
Expected: PASS.

- [ ] **Step 2: Run broader sync regression coverage**

Run:
```bash
node --test test/usage-aggregate.test.js test/usage-rollup.test.js test/rollout-parser.test.js
```
Expected: PASS.

- [ ] **Step 3: Manual smoke**

Run:
```bash
node src/cli.js status
node src/cli.js init --yes --dry-run
node src/cli.js sync --from-openclaw
```
Expected:
- one OpenClaw integration path
- no transcript/fallback references
- no crashes

- [x] **Step 4: Record evidence**
  - Save commands and outcomes in the change evidence / PR notes.
  - Note explicitly that OpenClaw project attribution remains out of scope in v1.

### Validation evidence (2026-04-05)

Focused OpenClaw regression coverage:

```bash
node --test test/openclaw-usage-ledger.test.js test/openclaw-session-plugin.test.js test/sync-openclaw-sanitized.test.js test/sync-openclaw-trigger.test.js test/status.test.js test/diagnostics.test.js test/doctor.test.js test/subscriptions.test.js test/install-status.test.js
```

Outcome: PASS

Broader parser / rollup regression coverage:

```bash
node --test test/usage-aggregate.test.js test/usage-rollup.test.js test/rollout-parser.test.js
```

Outcome: PASS

OpenSpec validation:

```bash
npx openspec validate refactor-openclaw-sanitized-usage-ingress --strict
```

Outcome: PASS

Real local confirmation after manual `openclaw gateway restart`:

```bash
openclaw agent --session-id vibeusage-sanitized-probe --message "Reply with exactly OK." --timeout 120 --json
npx vibeusage sync --from-openclaw
npx vibeusage sync --from-openclaw
```

Observed outcomes:
- `~/.vibeusage/tracker/openclaw-usage-ledger.jsonl` existed after the real OpenClaw turn.
- Ledger rows contained only sanitized fields; no raw `sessionKey`, `assistantTexts`, `lastAssistant`, or `workspaceDir`.
- First `sync --from-openclaw` consumed the ledger and uploaded `source = "openclaw"` buckets.
- Second `sync --from-openclaw` queued/uploaded nothing new, confirming idempotency.
- OpenClaw project attribution remains out of scope in v1.

- [ ] **Step 5: Commit**

```bash
git add .
 git commit -m "test: verify openclaw sanitized ingress rewrite"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-04-openclaw-sanitized-usage-ingress.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?