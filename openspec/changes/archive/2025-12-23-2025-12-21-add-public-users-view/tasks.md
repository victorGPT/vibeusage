## 1. Validation (pre-change)
- [x] 1.1 Confirm `public.users` is missing and `auth.users` exists.
- [x] 1.2 Record current `search_path` and role grants for reference.

## 2. Database change
- [x] 2.1 Create view: `create view public.users as select * from auth.users;`
- [x] 2.2 Grant read access: `grant select on public.users to anon, authenticated;`

## 3. Verification
- [x] 3.1 Query `select count(*) from public.users;` succeeds.
- [x] 3.2 Call `GET /functions/vibescore-debug-auth` with bearer token; expect `authOk: true` and `userId` populated.
- [x] 3.3 Refresh dashboard; `GET /functions/vibescore-usage-summary` returns 200.

## 4. Rollback (if needed)
- [x] 4.1 Drop view: `drop view public.users;`
- [x] 4.2 Re-run diagnostics to confirm prior behavior.
