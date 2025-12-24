# Change: Serve static rich link metadata on landing page

## Why
- Current rich link meta tags are injected at runtime, which some crawlers do not execute.
- We need social previews (Open Graph/Twitter) to be present in the initial HTML response.

## What Changes
- Inject Open Graph/Twitter meta tags at build time from `dashboard/src/content/copy.csv`.
- Add a canonical `og:url` value (`https://www.vibescore.space`).
- Remove client-side rich link injection from `dashboard/src/main.jsx`.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/index.html`, `dashboard/vite.config.js`, `dashboard/src/main.jsx`, `dashboard/src/content/copy.csv`
- **BREAKING**: none

## Risks & Mitigations
- Risk: Copy registry parse fails during build. Mitigation: validate registry and fall back to existing HTML in dev.
- Risk: Social preview regressions. Mitigation: verify `dashboard/dist/index.html` meta tags in build output.

## Rollout / Milestones
- M1: OpenSpec change validated
- M2: Build-time injection implemented with regression check
- M3: Deploy and validate social preview tags
