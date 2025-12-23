# 2025-12-17-vibescore-tracker 提案

## 结论

默认采用 **Codex CLI notify（agent-turn-complete）事件驱动** 的采集方案；客户端不常驻，解析与同步通过本地队列与增量 `sync` 完成；云端使用 InsForge 做登录、设备绑定、幂等入库与聚合查询。

## 选择理由（第一性原则）

- “自动”需要触发器：notify 提供了最直接、最低资源成本的触发点
- 客户端复杂度最小：避免 launchd 常驻与安装器，先用 `npx init` 跑通闭环
- 可靠性来自补账：本地队列 + `sync` 可重跑，保证最终一致

## 范围（MVP）

- macOS
- 全局 token 趋势（按天聚合）
- `init / sync --auto / status / uninstall`
- InsForge：登录 + 设备 token + ingest + 查询聚合

## 关键风险

- Codex 日志结构可能变化：解析器必须容错、可回滚、可通过 `sync` 重算
- 隐私风险：rollout 含对话内容，必须严格只提取 token_count 数字字段
- notify 共存：不得覆盖用户已有 notify，需要链式调用并可恢复

## 备选方案（Plan B）

- `--no-notify`：通过系统定时任务运行 `sync --auto`（后续再做，避免 MVP 增加安装复杂度）

