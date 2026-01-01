# Change: Add landing auth buttons

## Why
Landing visitors need a clear, immediate path to sign in or create an account without scrolling or finding the primary CTA.

## What Changes
- Add Login and Sign Up buttons to the landing page header (top-right).
- Use copy registry entries for button labels.
- Ensure both buttons link to auth endpoints with the correct redirect URL.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/pages/LandingPage.jsx`, `dashboard/src/App.jsx`, `dashboard/src/content/copy.csv`
