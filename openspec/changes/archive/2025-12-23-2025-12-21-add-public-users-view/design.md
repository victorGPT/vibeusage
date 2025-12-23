# Design: public.users auth compatibility view

## Context
Diagnostics show:
- `auth.users` exists.
- `public.users` does not exist.
- `auth.getCurrentUser()` fails with `relation "public.users" does not exist`.

This indicates the auth layer queries `public.users` via the current `search_path` ("$user", public).

## Options
1) **Create `public.users` view** that points to `auth.users`.
   - Pros: minimal change, reversible, no code changes, aligns with expected schema.
   - Cons: adds a view in `public` (must ensure least-privilege grants).
2) **Adjust `search_path`** to include `auth` for the runtime.
   - Pros: no new objects in `public`.
   - Cons: global impact, harder to scope, risk of unintended object resolution.
3) **Change edge functions to bypass auth SDK**.
   - Pros: avoids DB schema dependency.
   - Cons: high risk, larger code change, weakens security model.

## Decision
Adopt **Option 1**. It directly restores the missing relation required by the auth layer, is narrowly scoped, and is safe to roll back.

## Security considerations
- The view must be read-only.
- Grant `SELECT` only to roles that need it (typically `anon`, `authenticated`).
- No writes are enabled through the view.

## Rollback
- `drop view public.users;`
