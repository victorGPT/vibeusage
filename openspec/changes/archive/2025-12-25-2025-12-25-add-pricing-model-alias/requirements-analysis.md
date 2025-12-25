# Requirement Analysis

## Goal
- Ensure usage model names map to OpenRouter pricing models via auditable alias records.

## Scope
- In scope:
  - Alias table for usage->pricing model mapping with `effective_from`.
  - Resolver uses alias before suffix matching.
  - Pricing sync generates aliases using vendor rules and OpenRouter latest model.
- Out of scope:
  - UI for managing aliases.
  - Automatic vendor expansion beyond approved prefixes.

## Users / Actors
- Scheduled automation (GitHub Actions)
- Backend edge functions
- Dashboard/usage endpoints

## Inputs
- Usage models from `vibescore_tracker_hourly` (last 30 days).
- OpenRouter models list (with `id`, `created`, `pricing`).

## Outputs
- Alias rows in `vibescore_pricing_model_aliases`.
- Pricing resolver matches usage models to pricing models via alias.

## Business Rules
- Alias matches take precedence over suffix matching.
- Alias decisions are frozen by `effective_from` and are not retroactively changed.
- Vendor mapping rules are limited to `claude-*` -> `anthropic/*` and `gpt-*` -> `openai/*`.

## Assumptions
- OpenRouter `created` is available for "latest" selection; fallback to `context_length` then `id`.
- Default pricing model remains `gpt-5.2-codex`.

## Dependencies
- OpenRouter Models API and existing pricing sync.
- InsForge database access for alias table.

## Risks
- Incorrect vendor inference -> wrong alias mapping.
- Usage models may include unexpected prefixes -> fallback to default pricing.
