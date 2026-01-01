# Requirement Analysis

## Goal
- Provide immediate, visible access to authentication from the landing page header.

## Scope
- In scope:
  - Landing page header UI for unauthenticated visitors.
  - Copy registry entries for Login and Sign Up labels.
  - Auth URLs for sign-in and sign-up with redirect support.
- Out of scope:
  - Auth backend behavior.
  - Session management or dashboard auth gates.
  - Landing page CTA or hero content changes.

## Users / Actors
- Unauthenticated visitors on the landing page.

## Inputs
- `baseUrl` (InsForge base URL).
- `redirectUrl` (safe redirect to `/auth/callback`).
- Copy registry keys: `landing.nav.login`, `landing.nav.signup`.

## Outputs
- Two header buttons aligned to the top-right of the landing page.
- Login -> `/auth/sign-in` URL, Sign Up -> `/auth/sign-up` URL.

## Business Rules
- Buttons MUST be visible without scrolling.
- Labels MUST come from the copy registry (no hard-coded text).
- URLs MUST include the redirect parameter derived from the landing page.

## Assumptions
- The landing page only renders in the unauthenticated state.
- `buildAuthUrl` already handles redirect URLs safely.

## Dependencies
- `dashboard/src/lib/auth-url.js` for URL construction.
- `MatrixButton` component and Matrix UI styles.
- Copy registry validation tooling.

## Risks
- Header overlap with existing fixed elements (e.g., GitHub star) on small screens.
- Missing copy keys would render empty labels.
