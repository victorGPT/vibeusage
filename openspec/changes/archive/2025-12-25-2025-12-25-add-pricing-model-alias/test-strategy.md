# Test Strategy

## Objectives
- Validate alias mapping resolution and sync behavior.
- Ensure fallback remains correct when alias is absent.

## Test Levels
- Unit:
  - Alias lookup precedence and effective_from selection.
  - Vendor rule selection and latest model choice.
- Integration:
  - Pricing sync writes alias rows for unmatched usage models.
- Regression:
  - Summary and model breakdown endpoints remain stable.

## Test Matrix
- Alias precedence -> Unit -> Backend -> new unit test
- Alias sync -> Integration -> Backend -> acceptance script
- Fallback behavior -> Regression -> Backend -> existing acceptance scripts

## Environments
- Local with mocked OpenRouter response.
- InsForge (manual verification via SQL).

## Automation Plan
- Add `scripts/acceptance/pricing-model-alias.cjs`.

## Entry / Exit Criteria
- Entry: OpenSpec change approved.
- Exit: Acceptance scripts pass and alias rows observable in DB.

## Coverage Risks
- Vendor rules cover only `claude-*` and `gpt-*` prefixes.
