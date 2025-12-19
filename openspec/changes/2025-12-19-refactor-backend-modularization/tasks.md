# 2025-12-19-refactor-backend-modularization 任务清单

> 目标：在不改变对外 contract 的前提下，降低后端/接口变更的扩散半径与重复实现风险。

## 1) Contract freeze（Non-breaking）

- [x] 列出当前所有已部署 endpoints（paths + methods）
- [x] 明确：本次改动不改 query/body/response shape（仅 internal refactor）
- [x] 明确：InsForge2 约束：edge function 产物必须是单文件 + `module.exports`

当前 endpoints（均支持 `OPTIONS` 预检）：

- `POST /functions/vibescore-device-token-issue`
- `POST /functions/vibescore-ingest`
- `GET /functions/vibescore-usage-summary`
- `GET /functions/vibescore-usage-daily`
- `GET /functions/vibescore-usage-heatmap`
- `GET /functions/vibescore-leaderboard`
- `POST /functions/vibescore-leaderboard-settings`

## 2) Edge Functions 模块化（build-time）

- [x] 新建 `insforge-src/shared/*`（http/auth/env/date/numbers）
- [x] 将现有 `insforge-functions/*.js` 迁移为 `insforge-src/functions/*.js` entry（保持行为）
- [x] 新增 `scripts/build-insforge-functions.cjs`
- [x] 新增 `npm run build:insforge`（以及可选 `--check`）
- [x] 生成 `insforge-functions/*.js` 并确保可以被 Node tests `require()`

## 3) 接口调用层解耦（CLI/Dashboard）

- [x] CLI：新增 `src/lib/vibescore-api.js` 并替换 `src/lib/insforge.js` 与 `src/lib/uploader.js` 的直连调用
- [x] Dashboard：新增 `dashboard/src/lib/vibescore-api.js` 并替换 hooks 内拼 URL 的逻辑

## 4) Tests / Verification

- [x] `npm test`
- [x] `npm --prefix dashboard run build`
- [x] 补充开发者文档：`BACKEND_API.md`（endpoints + build/deploy）
- [x] 在 `openspec/project.md` 增加 `BACKEND_API.md` 入口与 build 说明
- [ ] （可选）跑一次 `node scripts/smoke/insforge-smoke.cjs`（需要真实环境变量/JWT）

## 5) Deploy（InsForge2）

- [x] 用 `insforge2 update-function` 逐个更新 edge functions（只更新代码，不改 slug）
- [ ] 手测：Dashboard 基本功能（summary/daily/heatmap/leaderboard）均可正常工作
