# Change: Add public.users view for auth compatibility

## Why
Edge functions rely on `auth.getCurrentUser()` to validate user JWTs. The runtime currently errors with `relation "public.users" does not exist`, which causes every dashboard request to return 401. The database has `auth.users` but no `public.users`, so the auth layer cannot resolve users.

## What Changes
- Create a `public.users` view that selects from `auth.users`.
- Grant read access to roles used by the edge runtime (`anon`, `authenticated`).
- Validate that auth calls succeed and dashboard endpoints return 200.

## Impact
- Affected specs: `vibescore-tracker`
- Affected data: adds a read-only view in the database (`public.users`).
- Affected runtime: auth validation path for all user-JWT endpoints.
