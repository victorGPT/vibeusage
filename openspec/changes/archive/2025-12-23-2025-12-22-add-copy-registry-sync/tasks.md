## 1. Discovery & scope
- [x] 1.1 Confirm official source path `origin/main:dashboard/src/content/copy.csv` and fallback policy.
- [x] 1.2 Define CLI surface for `copy-sync` (subcommands, flags, defaults).

## 2. Module Brief (integration gate)
- [x] 2.1 Produce Module Brief (scope, interfaces, data flow, non-negotiables, tests, milestones, plan B).

## 3. Implementation
- [x] 3.1 Add `scripts/copy-sync.cjs` with `pull` and `push` commands.
- [x] 3.2 Implement `pull` with dry-run default, backup, and source display.
- [x] 3.3 Implement `push` with validation, diff preview, and explicit confirm.
- [x] 3.4 Add npm scripts `copy:pull` and `copy:push`.
- [x] 3.5 Auto-commit `copy.csv` when it is the only dirty file on `push --confirm`.

## 4. Safety & validation
- [x] 4.1 Enforce clean working tree before pull writes; push allows only `copy.csv` dirty.
- [x] 4.2 Abort on CSV schema mismatch or validation errors.
- [x] 4.3 Block push when dirty files exist outside `copy.csv`.

## 5. Docs
- [x] 5.1 Update `docs/copy-registry.md` with sync workflow and safety notes.

## 6. Verification
- [x] 6.1 `node scripts/copy-sync.cjs pull --dry-run`
- [x] 6.2 `node scripts/copy-sync.cjs pull --apply`
- [x] 6.3 `node scripts/copy-sync.cjs push --dry-run`
- [x] 6.4 `node scripts/copy-sync.cjs push --confirm --push-remote`
