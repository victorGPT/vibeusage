# 2025-12-18-fix-service-role-key-missing 任务清单

## M1：init 可完成（无 service role key）

- [x] 补齐 `vibescore_tracker_device_tokens` 的 RLS：允许登录用户为“自己的 device”创建 token
- [x] 更新并部署 `vibescore-device-token-issue`：移除对 `SERVICE_ROLE_KEY` 的硬依赖（保留 admin mode：有 key 才可用）
- [x] 自动化用例：`device-token-issue` 在缺失 `SERVICE_ROLE_KEY` 时仍能成功（单测）

## M2：ingest 可写入（无 service role key，幂等）

- [x] 新增 DB 辅助函数：从请求头读取 `x-vibescore-device-token-hash`（用于 token lookup）
- [x] 新增/调整 RLS：允许持有 device token 的请求读取对应 token 行，并写入 `vibescore_tracker_events`（通过 `device_token_id` + DB helper 校验）
- [x] 更新并部署 `vibescore-ingest`：无 `SERVICE_ROLE_KEY` 时用 `anonKey + records API (Prefer: return=minimal)` 写入；遇到 `23505` 批量冲突则降级逐条插入
- [x] 自动化用例：重复 ingest 同一批 events 不报错且不重复计数（单测）

## M3：查询闭环

- [x] `vibescore-usage-daily/summary` 在插入事件后能返回非 0 数据（冒烟脚本）

## M4：自动化与可回归

- [x] 增加一键冒烟脚本：使用“已验证的 email/password 测试账号”→ 签发 device token → ingest → 查询 summary/daily 校验
- [x] `openspec validate 2025-12-18-fix-service-role-key-missing --strict` 通过

## 验收证据（完成时补齐）

- [x] 终端录屏：`npx --yes /tracker init` → 浏览器登录 → CLI 成功落盘 `~/.vibescore/tracker/config.json`
- [x] 终端录屏：产生一段 token_count 日志 → `npx --yes /tracker sync` → Dashboard 看到 UTC 日聚合数据更新
