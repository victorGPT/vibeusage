## Context
- 运行时偶发超时，表现为 ingest 请求在客户端超时而日志可能缺席。
- 当前 ingest 逻辑在 anon key 路径遇到重复事件时可能触发逐条写入，放大单次请求成本。
- Dashboard 健康探针固定 15s 轮询，常驻时产生持续负载。

## Goals / Non-Goals
- Goals:
  - 降低 ingest 单次请求成本的尾部风险（duplicate-heavy 场景）
  - 客户端自动同步具备强退避，降低 burst
  - Dashboard 常驻负载可控
- Non-Goals:
  - 不引入新的后端服务或复杂队列系统
  - 不要求升级套餐

## Module Brief
### Scope
- In: ingest 写入路径优化、CLI 退避策略、Dashboard 探针降频/可见性暂停
- Out: 后端架构重写、数据库迁移、前端大改

### Interfaces
- `POST /functions/vibescore-ingest`
- CLI `sync --auto`
- Dashboard `useBackendStatus` 探针

### Data flow and constraints
- 设备端事件 → CLI batch → ingest → DB
- 预算约束：小规格运行时可能频繁重启或冷启动
- 安全约束：不引入 service role 强依赖，保持 anon key 也能工作

### Non-negotiables
- 幂等性（重复上传不重复计数）
- 无 PII 泄露
- 失败后可重试且不会放大负载

### Test strategy
- 合成脚本：重复事件批量上传（duplicate-heavy）应返回 200 且 inserted/skipped 正确
- 回放脚本：同一批次重复上传不会新增
- Dashboard 探针在页面隐藏时应停止请求

### Milestones
1. ingest 重复事件路径优化（批量写 + 去重）
2. CLI 退避策略完善（遵循 Retry-After）
3. Dashboard 探针降频 + 可见性暂停
4. 验证与回归脚本

### Plan B triggers
- 记录 API 无法支持批量去重 → 采用 RPC / SQL function 处理
- 仍频繁超时 → 评估更低频率上传或升级套餐

### Upgrade plan (disabled by default)
- 保留文档化的升级路径（更高规格或后台队列）作为最后手段

## Decisions
- 以“减少单次请求成本”为首要目标，其次是削峰与退避。
- 保持 anon key 能工作，避免引入 service role 硬依赖。

## Risks / Trade-offs
- 更严格的退避可能导致数据“更慢可见”
- 探针降频降低“即时健康”反馈

## Migration Plan
- 分阶段上线：先优化 ingest，再调整 CLI/前端探针
- 保留可回滚的配置（环境变量/常量）

## Open Questions
- InsForge records API 是否支持 `on_conflict`/`ignore duplicates`
- 运行时日志是否能稳定提供超时/重启标记
