# Design: backend modularization & API decoupling

## Scope

IN:
- Edge Functions 在保持单文件部署约束下实现模块化（build-time bundling）
- 统一横切关注点：CORS, JSON envelope, auth, env, UTC date helpers, number/bigint helpers
- CLI/Dashboard 调用层的 endpoint 与 fetch 逻辑收敛到各自的 API module
- 保持现有 API contract 不变（paths/params/shapes 不变）

OUT:
- 修改任何 endpoint contract（包括字段名、错误语义、HTTP status）
- 新增对外公开 API / 版本化（`/v1` 等）
- 引入运行时依赖（edge function 运行时 `import` 外部文件）

## Module Brief

### Interfaces

#### Build interface

- Inputs: `insforge-src/functions/*.js`
- Outputs: `insforge-functions/*.js`
- Command: `node scripts/build-insforge-functions.cjs`

#### Runtime interface (unchanged)

- Each file in `insforge-functions/*.js` exports:
  - `module.exports = async function(request) { ... }`

#### Client interface

- CLI: `src/lib/vibescore-api.js`
- Dashboard: `dashboard/src/lib/vibescore-api.js`

### Trust boundaries

- Edge Functions continue to rely on:
  - `Authorization: Bearer <user_jwt>` for user endpoints
  - `Authorization: Bearer <device_token>` for ingest endpoints
- No secrets are embedded; they are read via `Deno.env.get(...)`

## Architecture (recommended)

### Edge shared modules (source)

Create small, dependency-free modules under `insforge-src/shared/`:

- `http.js`: `corsHeaders`, `json()`, `methodGuard()`, `readJson()` (for POST)
- `auth.js`: `getBearerToken()`, `requireUser(edgeClient)`
- `env.js`: `getBaseUrl()`, `getServiceRoleKey()`, `getAnonKey()`
- `date.js`: UTC calendar helpers used by multiple endpoints
- `numbers.js`: `toBigInt()`, `toNonNegativeInt()`, etc.

Each endpoint entry under `insforge-src/functions/` composes these.

### Bundling strategy

Goal: keep runtime identical, but allow multi-file authoring.

Option A (recommended): `esbuild`
- `format: cjs` (preserve `module.exports`)
- bundle each entry to one output file
- avoid external runtime imports

Option B: Node-based concatenation
- explicitly concatenate shared prelude + entry body
- lowest dependency, but more fragile

## Test strategy

- Keep unit tests importing from `insforge-functions/*` (deployment artifacts).
- Add a build verification step to developer workflow:
  - `npm run build:insforge`
  - `npm test`
- (Optional) add `--check` mode to fail if outputs are stale.

## Rollout plan

1. Introduce `insforge-src/` + build script; do not change behavior.
2. Regenerate `insforge-functions/*`; verify `npm test` passes.
3. Refactor CLI/Dashboard to use new API modules; verify dashboard build.
4. Deploy updated edge functions via `insforge2 update-function`.

