## 1. Implementation
- [x] 1.1 Add local cache read/write for usage summary/daily in `useUsageData` (keyed by user + period/range + includeDaily).
- [x] 1.2 Implement stale-while-revalidate flow: show cached data immediately and keep it on fetch errors.
- [x] 1.3 Expose cache metadata (`source`, `fetchedAt`) to the UI and display a cached/stale indicator.
- [x] 1.4 Ensure cache is isolated per user (no cross-user leakage).

## 2. Verification
- [x] 2.1 Manual: load dashboard online, then simulate backend failure and confirm cached data remains visible with stale label.
- [x] 2.2 Manual: sign out or switch user, confirm cache does not leak between identities.
