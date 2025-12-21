## 0. Discovery & constraints
- [x] 0.1 Fetch InsForge SDK docs via MCP (`instructions`, `auth-components-react`, `functions-sdk`, `db-sdk`).
- [x] 0.2 Resolve latest `@insforge/sdk` version from npm registry; record in proposal.
- [x] 0.3 Confirm SDK runtime compatibility with Node 18 (CJS) and Vite (ESM).

## 1. Module Brief & design alignment
- [x] 1.1 Confirm Module Brief assumptions; finalize `anonKey` handling and auth mapping.
- [x] 1.2 Define rollback strategy (freeze commit) and failure triggers.

## 2. SDK dependency & client wrappers
- [x] 2.1 Add `@insforge/sdk@<version>` to root `package.json`.
- [x] 2.2 Add `@insforge/sdk@<version>` to `dashboard/package.json`.
- [x] 2.3 Implement CLI SDK client wrapper `src/lib/insforge-client.js`.
- [x] 2.4 Implement Dashboard SDK client wrapper `dashboard/src/lib/insforge-client.js`.

## 3. CLI migration (full)
- [x] 3.1 Migrate `src/lib/vibescore-api.js` to SDK calls.
- [x] 3.2 Update `src/lib/insforge.js` to use new API layer.
- [x] 3.3 Remove or isolate obsolete HTTP helpers if unused.

## 4. Dashboard migration (full)
- [x] 4.1 Migrate `dashboard/src/lib/vibescore-api.js` to SDK calls.
- [x] 4.2 Remove/retire `dashboard/src/lib/http.js` if no longer used.
- [x] 4.3 Ensure auth token propagation is preserved.

## 5. Validation & acceptance
- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `npm --prefix dashboard run build`.
- [ ] 5.3 Manual: sign-in flow works; usage summary/daily/heatmap load without regression.

## 6. Docs & freeze
- [x] 6.1 Update docs/config notes if new env vars are required.
- [ ] 6.2 Record freeze commit hash and update `tasks.md` statuses.

## Milestones & Acceptance
- [ ] M1 SDK lock-in: both packages depend on identical `@insforge/sdk` version; SDK clients compile.
- [ ] M2 CLI migration: CLI requests all routed via SDK; tests pass.
- [ ] M3 Dashboard migration: all data fetching via SDK; dashboard build passes.
- [ ] M4 Cleanup & freeze: old HTTP wrappers removed or unused; docs updated; freeze hash recorded.
