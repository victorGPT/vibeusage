# Test Strategy

## Objectives
- Verify Login and Sign Up buttons render on the landing page header.
- Verify both buttons navigate to the correct auth URLs.
- Ensure copy registry keys are used for labels.

## Test Levels
- Unit:
  - Optional: string/URL construction checks (if extracted helpers are added).
- Integration:
  - Landing page renders with auth buttons when unauthenticated.
- Regression:
  - Landing page loads without layout regressions.

## Test Matrix
- Auth buttons visible -> Integration -> UI -> header shows Login/Sign Up
- Auth URLs correct -> Manual -> UI -> click navigates to sign-in/sign-up with redirect
- Copy registry keys -> Integration -> UI -> labels match copy.csv

## Environments
- Local dashboard dev server (`npm --prefix dashboard run dev`).

## Automation Plan
- No automated UI tests required for this small UI change.

## Entry / Exit Criteria
- Entry: OpenSpec change approved.
- Exit: Manual verification complete; regression statement recorded.

## Coverage Risks
- No automated UI test coverage for layout/interaction in CI.
