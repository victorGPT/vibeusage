## ADDED Requirements

### Requirement: Edge functions use a single ESM author and deploy contract

The system SHALL author every live `vibeusage-*` edge function from `insforge-src/functions-esm/` and SHALL generate deploy artifacts without CommonJS wrappers or legacy source fallbacks.

#### Scenario: Local build graph uses only ESM author sources

- **GIVEN** the repository builds Insforge edge-function artifacts
- **WHEN** `scripts/build-insforge-functions.cjs` runs
- **THEN** it SHALL scan only `insforge-src/functions-esm/`
- **AND** it SHALL NOT build a CommonJS artifact branch from `insforge-src/functions/`

#### Scenario: Local loader resolves every live function from the ESM source tree

- **GIVEN** a local regression test loads an edge function by slug
- **WHEN** `scripts/lib/load-edge-function.cjs` resolves the source path
- **THEN** it SHALL load the slug from `insforge-src/functions-esm/`
- **AND** it SHALL NOT fall back to a legacy source or generated-artifact path to preserve compatibility

#### Scenario: Generated artifacts do not contain CommonJS deploy wrappers

- **GIVEN** `insforge-functions/<slug>.js` is generated from the build pipeline
- **WHEN** the artifact is inspected
- **THEN** it SHALL NOT contain `__commonJS`, `module.exports`, or `require(...)`
