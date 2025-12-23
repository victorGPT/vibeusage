# Change: Optimize Lighthouse score for landing + dashboard (local preview)

## Why
- The landing page and signed-in dashboard must each reach a Lighthouse Performance score of at least 95 on desktop to ensure a fast, reliable first impression.

## What Changes
- Optimize the landing page critical rendering path (code-splitting, asset loading, and animation cost).
- Optimize the signed-in dashboard critical rendering path with the same standards.
- Reduce main-thread blocking work and unnecessary rerenders during initial load.
- Adjust non-critical visual effects to defer or lower their cost without changing the Matrix UI A theme.

## Impact
- Affected specs: vibescore-tracker
- Affected code: dashboard/**
- **BREAKING**: None

## Architecture / Flow
- No API or data-flow changes. UI rendering and resource-loading paths are optimized while keeping data logic unchanged.

## Risks & Mitigations
- Risk: Visual regressions in Matrix UI A effects.
  Mitigation: Keep component structure intact; use small, reversible changes and verify before/after screenshots.
- Risk: Lighthouse score instability on local preview due to variance or caching.
  Mitigation: Fix measurement settings and run multiple audits for consistency.

## Rollout / Milestones
- Baseline audit and bottleneck diagnosis
- Targeted optimizations
- Regression verification and Lighthouse re-run
