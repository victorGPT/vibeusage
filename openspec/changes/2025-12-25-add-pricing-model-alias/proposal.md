# Change: Add pricing model alias mapping

## Why
- Usage model names do not always match OpenRouter model IDs, causing pricing lookups to fail.
- We need a stable, auditable mapping that can freeze "latest" decisions at a point in time.

## What Changes
- Add a `vibescore_pricing_model_aliases` table to map `usage_model` -> `pricing_model` with `effective_from`.
- Update pricing resolver to use alias mapping before suffix matching.
- Extend pricing sync to generate alias mappings based on vendor rules and OpenRouter "latest" model.
- Add health check SQL to report unmatched usage models.

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `insforge-src/shared/pricing.js`, `insforge-src/functions/vibescore-pricing-sync.js`
- **BREAKING** (if any): None

## Architecture / Flow
- Sync fetches OpenRouter models -> upserts pricing profiles -> resolves missing usage models -> writes alias rows with `effective_from`.
- Resolver: usage_model -> alias (if any) -> pricing profile lookup.

## Risks & Mitigations
- Incorrect alias mapping -> restrict vendor rules and freeze decisions with `effective_from`.
- Schema drift -> acceptance tests on mapping and fallback behavior.

## Rollout / Milestones
- M1: Requirements + acceptance.
- M2: OpenSpec deltas approved.
- M3: Implementation + tests.
- M4: Deploy + verify.
