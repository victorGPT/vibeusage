## Context
当前 TREND 与 DETAILS 会用 `future` 标记未来桶，但仍渲染占位（例如空线或“—/0”）。需求要求未来数据完全不展示。

## Goals / Non-Goals
- Goals:
  - TREND 与 DETAILS 完全不渲染未来桶/行。
  - 已发生区间仍能展示 `missing`（未同步）与 0 值区分。
- Non-Goals:
  - 不改变后端聚合或查询参数。
  - 不改变热力图范围（Heatmap 继续覆盖完整周期）。

## Decisions
- Decision: 在“展示层”过滤 future，而不是在后端裁剪，避免影响其他模块。
- Alternative: 在 hooks 中裁剪（统一语义），但会影响共享数据（如 Trend 复用 daily）。实现时需谨慎评估共享路径。

## Risks / Trade-offs
- 过滤层位置选择不当可能影响缓存或复用逻辑。
- 需要保证“当前日/小时”的边界判定一致（使用已有 `future` 标记作为权威）。

## Verification Strategy
- Dashboard：分别切换 day/week/month/total，确认 TREND 与 DETAILS 仅显示到当前时间。
- Mock 数据：`?mock=1` 下验证仍能正确裁剪未来桶。
