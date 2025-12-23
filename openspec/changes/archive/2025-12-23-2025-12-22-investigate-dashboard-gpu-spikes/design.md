## Context
Dashboard 空闲静置时出现 GPU 突刺，Landing 较轻但同样存在；线上环境也会复现。已排除 MatrixRain 为主因。需要通过可重复的性能剖析与隔离实验，找到导致 GPU 突刺的具体组件/视觉效果。

## Goals / Non-Goals
- Goals:
  - 建立可复现的 GPU 突刺测量基线（Dashboard/Landing 对比）。
  - 形成可执行的隔离矩阵（逐步禁用特效/动画）。
  - 产出根因证据与修复建议（可最小化影响）。
- Non-Goals:
  - 本阶段不直接修改视觉设计或引入新依赖。
  - 不在该变更内实现最终修复（另起 apply 变更）。

## Module Brief
### Scope
- IN: Dashboard/Landing 的渲染负载排查与证据采集。
- OUT: 后端接口、数据模型变更。

### Interfaces
- 无新增对外接口。

### Data flow and constraints
- 以 Chrome Task Manager 的 GPU Process 与 Performance 面板为基准。
- 测量窗口：前台静置 ≥60s，记录突刺频率与幅度。
- 隔离手段优先使用 DevTools 覆盖（不改代码）。

### Non-negotiables
- 不能以“移除核心视觉效果”为默认解法。
- 保持 Landing 与 Dashboard 视觉一致性优先。

### Test strategy
- Baseline: Dashboard 与 Landing 的空闲 GPU 记录。
- Isolation: 分组禁用动画/模糊/阴影/定时器驱动组件，对比差异。
- Evidence: 保存 Performance Trace（含 GPU 轨迹与合成/绘制事件）。

### Milestones
- M1: 基线与复现步骤固定（Dashboard/Landing）。
- M2: 隔离矩阵完成并收敛到 1~2 个主因。
- M3: 修复建议与影响评估输出。

### Plan B triggers
- 若 DevTools 覆盖无法稳定定位，追加最小化诊断开关（仅用于排查）。

## Decisions
- Decision: 先做“可复现 + 可对比 + 可隔离”的证据链，再讨论修复方案。

## Risks / Trade-offs
- 可能存在多因子叠加，需要组合隔离策略。
- 线上/本地差异可能来自不同渲染管线（Chrome/Safari/GPU driver）。

## Assumptions
- 以 macOS + Chrome Task Manager 的 GPU Process 作为默认测量口径。
