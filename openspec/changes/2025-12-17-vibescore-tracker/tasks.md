# 2025-12-17-vibescore-tracker 任务清单

## MVP-0（规格与落地路径）

- [x] 固化事件模型与字段白名单（只允许 token_count.info.*）
- [x] 定义本地状态与队列格式（MVP：JSON/JSONL + offset；后续可迁移 SQLite）
- [x] 定义 InsForge 数据表与 RLS（events / devices / aggregates）
- [x] 定义 ingest 合约（批量、幂等、错误码）

## MVP-1（端到端闭环：本地→云端→看板）

- [x] `@vibescore/tracker` CLI 骨架（init/sync/status/uninstall）
- [x] `init`：备份并写入 `~/.codex/config.toml` notify（链式保留已有 notify）
- [x] 安装 `notify-handler` 到 `~/.vibescore/bin/notify.cjs`（快速落盘、退出 0）
- [x] `sync --auto`：增量解析 `~/.codex/sessions/**/rollout-*.jsonl` → 入队 → 上传
- [x] Dashboard：InsForge 登录（用于获取 user_jwt 并展示使用数据）
- [x] 云端：设备 token 发行（`vibescore-device-token-issue`，登录态）
- [x] 云端：InsForge edge function `ingest`（鉴权 + 幂等去重）
- [x] 云端：daily 查询（`vibescore-usage-daily`）
- [x] 云端：summary 查询（`vibescore-usage-summary` 或前端对 daily 再聚合）
- [x] Dashboard：按天曲线（先做最小可用）

## MVP-2（可靠性与排障）

- [x] 本地重试与退避；互斥锁防止并发 sync
- [x] `status/diagnostics`（脱敏导出）
- [x] Dashboard 顶部显示后端状态（显示 host；hover 查看 status/http）
- [x] 可重复验收脚本：断网→产生事件→恢复→补传成功（`node scripts/acceptance/offline-replay.cjs`）
- [x] 自动化单测：edge functions（service client 必须带 admin token，避免 RLS 回归）

## 验收证据（完成时补齐）

- [ ] 录屏/截图：初始化后使用 Codex CLI 产生数据 → 云端曲线更新
- [x] 冷回归步骤：`uninstall` 后 Codex 行为不受影响（自动化：`node --test test/init-uninstall.test.js`）
