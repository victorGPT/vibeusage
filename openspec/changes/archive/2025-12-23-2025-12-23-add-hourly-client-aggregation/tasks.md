## 1. Proposal & Design
- [x] 1.1 明确兼容策略：是否支持旧客户端事件上传（窗口期与淘汰计划）
- [x] 1.2 定义小时桶 payload（字段、类型、UTC 口径、幂等键）
- [x] 1.3 选择 upsert 语义（replace / max / monotonic）并记录理由

## 2. Client Aggregation
- [x] 2.1 本地按 UTC 半小时聚合 token_count（保证幂等与可重放）
- [x] 2.2 本地队列存储聚合桶（替换现有事件队列）
- [x] 2.3 上传策略：仅上传已完成半小时或支持同半小时覆盖
- [x] 2.4 auto sync 上传节流调整为 30 分钟
- [x] 2.5 `init` 结束后触发一次同步（手动 sync 仍立即上传）

## 3. Backend Ingest & Storage
- [x] 3.1 新增半小时聚合存储（表/视图）与唯一键（user_id + device_id + hour_start）
  - 2025-12-23: `vibescore_tracker_hourly` created (see `openspec/changes/2025-12-23-add-hourly-client-aggregation/sql/001_create_hourly.sql`)
- [x] 3.2 Ingest 接口支持 half-hour payload 并幂等 upsert
- [x] 3.3 若保留旧事件 ingest：实现双路径与迁移开关（本次不保留旧 ingest）
- [x] 3.4 明细事件保留策略：30 天 TTL（本次不再写入事件）
- [x] 3.5 历史事件回填到 half-hour 表
  - 2025-12-23: backfill `vibescore_tracker_hourly` from events (679 rows affected; total rows 689). SQL: `openspec/changes/2025-12-23-add-hourly-client-aggregation/sql/002_backfill_hourly_from_events.sql`
- [x] 3.6 事件保留清理脚本与 runbook
  - SQL: `openspec/changes/2025-12-23-add-hourly-client-aggregation/sql/003_purge_events_older_than_30d.sql`
  - Runbook: `openspec/changes/2025-12-23-add-hourly-client-aggregation/runbook.md`
- [x] 3.7 执行事件清理（删除 30 天前 events）
  - 2025-12-23: GitHub Actions dry-run → deleted=7441 (cutoff=2025-11-23T15:11:55.490Z)
  - 2025-12-23: GitHub Actions purge → deleted=7441 (cutoff=2025-11-23T15:14:49.399Z)
  - 2025-12-23: TRUNCATE public.vibescore_tracker_events (manual)
- [x] 3.9 移除旧事件写入路径（禁用 events 表 INSERT）
  - 2025-12-23: Dropped policy `vibescore_tracker_events_insert_by_device_token` (public INSERT disabled)
- [x] 3.8 自动化清理（Edge Function + GitHub Actions）
  - Function: `vibescore-events-retention` (insforge2) ✅
  - SQL RPC: `openspec/changes/2025-12-23-add-hourly-client-aggregation/sql/004_create_retention_rpc.sql` ✅
  - Workflow: `.github/workflows/vibescore-events-retention.yml` ✅
  - Secrets: `INSFORGE_BASE_URL`, `INSFORGE_SERVICE_ROLE_KEY` / `INSFORGE_API_KEY`（需在 GitHub 仓库配置）

## 4. Query Path Update
- [x] 4.1 日/月/汇总查询基于 half-hour 聚合
- [x] 4.2 heatmap/leaderboard 若依赖事件，切换到聚合表
- [x] 4.3 回归测试与验收脚本更新

## 5. Verification
- [x] 5.1 单元测试：小时聚合一致性与幂等
- [x] 5.2 接口测试：重复上传同桶不双计
- [x] 5.3 端到端：Dashboard 与 CLI 路径回归（`npm test` + acceptance）
  - 2025-12-23: `npm test`; `node scripts/acceptance/run-acceptance.cjs --pretty`; `npm run build:insforge:check`
- [x] 5.4 CLI 行为：`init` 完成后生成游标 + `sync`（`node --test test/init-uninstall.test.js`）
