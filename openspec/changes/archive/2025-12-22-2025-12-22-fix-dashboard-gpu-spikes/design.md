## Context
Dashboard 空闲静置 GPU 突刺在本地与线上均复现。排查证据显示：禁用模糊/阴影可下降约 25%，禁用代码雨 + 模糊/阴影可下降约 30%，禁用动画对 GPU 影响不明显。结论是“合成类特效（尤其是 `backdrop-filter`）+ 代码雨”是主贡献因子。

## Goals / Non-Goals
- Goals:
  - 降低 GPU 突刺（目标：静置时明显回落，接近低占用基线）。
  - 保留代码雨与 Matrix 风格，不提供用户开关。
  - 改动最小、可回退。
- Non-Goals:
  - 不引入新依赖/渲染管线（WebGL）。
  - 不做大范围重构或 UI 结构变更。

## Module Brief
### Scope
- IN: Dashboard 视觉特效预算、代码雨参数。
- OUT: 数据逻辑、后端接口。

### Interfaces
- 组件接口保持不变。

### Data flow and constraints
- 大面积容器禁用 `backdrop-filter`，用更高不透明度纯色层替代。
- 阴影效果缩减为小半径/低强度，仅保留在小面积元素。
- `MatrixRain` 进一步降低 `fps` 与 `scale`，保持全屏落雨。

### Non-negotiables
- 代码雨必须保留动态效果。
- 页面整体风格不被破坏（保持绿色矩阵视觉）。

### Test strategy
- 手动性能验证：Chrome Task Manager GPU Process。
- A/B 对比：改动前后静置 60s 记录平均与峰值。

### Milestones
- M1: 移除大面积 `backdrop-filter` 与重阴影。
- M2: `MatrixRain` 参数收敛。
- M3: 记录 GPU 对比证据并确认视觉可接受。

### Plan B triggers
- 若 GPU 仍明显偏高：进一步减少阴影/混合模式或降低雨滴密度。

## Decisions
- Decision: 先从“合成类特效预算”下手（大容器去模糊），再收敛代码雨成本。

## Risks / Trade-offs
- 视觉磨砂感减弱；通过更高不透明度与边框补偿。
- 部分局部 glow 变弱；以小面积保留效果。

## Assumptions
- GPU 评价以 Chrome Task Manager GPU Process 为准。
