# Acceptance Criteria

## Feature: Landing auth buttons

### Requirement: Landing page exposes Login and Sign Up entry points
- Rationale: Make authentication available without scrolling.

#### Scenario: Header shows auth buttons
- GIVEN the user is on the landing page (unauthenticated)
- WHEN the landing page renders
- THEN the header shows Login and Sign Up buttons in the top-right
- AND the labels are sourced from `landing.nav.login` and `landing.nav.signup`

#### Scenario: Login button links to sign-in
- WHEN the user clicks Login
- THEN the browser navigates to `/auth/sign-in` on the InsForge base URL
- AND the URL includes the redirect parameter for `/auth/callback`

#### Scenario: Sign Up button links to sign-up
- WHEN the user clicks Sign Up
- THEN the browser navigates to `/auth/sign-up` on the InsForge base URL
- AND the URL includes the redirect parameter for `/auth/callback`
