# Change: 修复 Dashboard 访问后端 Unauthorized

## Why
- Dashboard 已拿到 `accessToken` 但请求 `vibescore-usage-*` 返回 401。
- 说明 edge function 无法验证 user JWT，导致前端无法获取数据。

## What Changes
- 在 edge function 的 user JWT 校验路径中显式传入 `ANON_KEY`，避免默认环境未注入导致验证失败。
- 补充回归验证，确保有 token 时 `usage-summary` 返回 200。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/shared/auth.js`（影响所有依赖 user_jwt 的 functions）
