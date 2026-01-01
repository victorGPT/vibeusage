# Requirement Analysis

## Goal
- Establish lean, secure, cost-efficient architecture guardrails for VibeScore Tracker aligned with the current canvas modules.

## Scope
- In scope:
  - Module boundaries across CLI (`src/`), Edge Functions (`insforge-src/`), and Dashboard (`dashboard/`).
  - PostgreSQL-first data model principles (3NF, constraints, indexing, idempotency keys).
  - Security boundaries (least privilege, RLS, data minimization).
  - Performance/cost guardrails (query limits, aggregation paths, timeouts).
- Out of scope:
  - New product features or UI changes.
  - Database migrations or schema changes.
  - Hosting/vendor changes beyond InsForge/PostgreSQL.

## Users / Actors
- Small product/engineering team (primary authors).
- CLI runtime (data producer).
- Edge Functions (trusted write/read gateway).
- Dashboard (read-only client).
- InsForge PostgreSQL (system-of-record).

## Inputs
- `architecture.canvas` module map.
- `openspec/specs/vibescore-tracker/spec.md` requirements.
- Current Edge Functions, CLI, and Dashboard behavior.

## Outputs
- Architecture guardrails and acceptance criteria.
- OpenSpec proposal + spec deltas.
- Test strategy and milestones for TDD delivery.

## Business Rules
- PostgreSQL is the single source of truth for aggregates; redundancy requires measured justification.
- Time values use `timestamptz`; money uses `numeric`.
- UUIDs are normalized before idempotency comparisons.
- No prompt/response content is persisted or uploaded.
- All database writes are mediated by Edge Functions.
- Client SDK access is centralized via approved `insforge-client` wrappers; client code must not reference `INSFORGE_INTERNAL_URL`.

## Assumptions
- Small team (<=5 engineers) and low operational budget.
- InsForge Postgres is available and stable.
- Typical query ranges are limited (existing max range controls remain).

## Dependencies
- InsForge platform and PostgreSQL.
- Codex CLI `notify` and local session files.
- Existing Edge Functions and SDK usage.

## Risks
- Over-constraint slows iteration.
- Under-indexing degrades query performance.
- Boundary leakage (direct DB access) increases security risk.
