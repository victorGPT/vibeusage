# Module Brief: Copy Registry Sync (origin/main)

## Scope
- IN:
  - Provide a local CLI script `copy-sync` with `pull` and `push` subcommands.
  - Treat `origin/main:dashboard/src/content/copy.csv` as the authoritative source.
  - Validate schema, show diffs, and gate writes with explicit confirmation.
- OUT:
  - No external CMS or remote configuration system.
  - No auto-merge conflict resolution.
  - No runtime hot reload or multi-language features.

## Interfaces
- CLI:
  - `node scripts/copy-sync.cjs pull [--dry-run] [--apply]`
  - `node scripts/copy-sync.cjs push [--dry-run] [--confirm] [--push-remote]`
- Files:
  - Read/write `dashboard/src/content/copy.csv`.
  - Read official copy from `origin/main` (fallback to local `main` only if `origin/main` unavailable).
- Dependencies:
  - Git CLI (`git show`, `git diff`, `git status`).

## Data Flow & Constraints
- Pull:
  1. Resolve authoritative source (`origin/main` or fallback).
  2. Read official CSV via `git show`.
  3. Validate schema and render diff.
  4. If `--apply`, backup local file and write new content.
- Push:
  1. Ensure no dirty files outside `copy.csv`.
  2. Validate local CSV schema.
  3. Show diff vs `origin/main`.
  4. If `--confirm`, auto-commit `copy.csv` if needed and optionally push remote.

## Non-negotiables
- Default to `--dry-run` for both pull and push.
- Require explicit confirmation for any write or remote push.
- Abort on schema mismatch or validation failures.
- For push, allow only `copy.csv` as a dirty file and auto-commit it before push.
- No secrets embedded; rely on user git credentials.

## Test Strategy
- Unit: schema validation for CSV columns and empty required fields.
- Integration: `pull --dry-run` and `push --dry-run` diff preview against `origin/main`.
- Safety: dirty working tree must block push.

## Milestones
- M1: CLI contract defined and documented (freeze: `proposal.md` + `design.md`).
- M2: Pull workflow implemented and verified (`--dry-run` and `--apply`).
- M3: Push workflow implemented and verified (`--dry-run`, `--confirm`, optional `--push-remote`).
- M4: Docs updated and validation script wired.

## Plan B Triggers
- Repeated diff failures due to binary/encoding mismatches → fallback to manual copy with validation.
- Git remote unavailable or permissions error → allow local-only sync and skip remote push.

## Upgrade Plan (disabled by default)
- If team scale grows or manual sync becomes error-prone, consider a dedicated remote registry service with audit logs.
