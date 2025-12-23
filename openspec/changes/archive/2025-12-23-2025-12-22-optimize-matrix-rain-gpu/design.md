## Context
MatrixRain 使用 `canvas` 全屏逐帧绘制（`requestAnimationFrame`），导致 GPU 常驻负载。需求要求保留动态效果且不给用户开关，但 GPU 常驻 <2%。该组件同时用于 Landing 与 Dashboard Shell。

## Goals / Non-Goals
- Goals:
  - 动态效果保留，整体氛围不变。
  - 前台静置时 GPU 使用率常驻 <2%。
  - 行为可解释、参数可控，便于后续微调。
- Non-Goals:
  - 不引入 WebGL/Shader 或新依赖。
  - 不增加用户侧开关或设置项。
  - 不改变页面结构与文案。

## Module Brief
### Scope
- IN: `MatrixRain` 渲染策略与调度策略。
- OUT: 其他 UI 组件、布局与数据逻辑。

### Interfaces
- 组件 API 不变：`<MatrixRain />`。

### Data flow and constraints
- 低分辨率缓冲：内部渲染尺寸按比例缩放（例如 `scale <= 0.6`），再拉伸至视口。
- 帧率上限：通过时间步进将更新频率限制在 `<= 12 fps`。
- 可见性暂停：`document.visibilityState === 'hidden'` 时不调度渲染。
- 减少 draw calls：列间距轻微增大，维持视觉密度但降低绘制次数。

### Non-negotiables
- 动态效果必须保留（不可静态替代）。
- 无用户可见开关。
- 需要满足 GPU 常驻 <2% 的预算目标。

### Test strategy
- 手动性能验证：Chrome Task Manager 观察 GPU process，前台静置 60s 平均 <2%。
- 交互验证：前台动效存在；隐藏/显示切换后能正确暂停/恢复。

### Milestones
- M1: 低分辨率渲染缓冲 + 帧率上限落地。
- M2: 可见性暂停 + 密度调优完成。
- M3: 记录性能验证结果，达成 GPU <2%。

### Plan B triggers
- 若 GPU 仍 >2%（60s 平均），进一步降低 `scale` 与 `fps`，或改为“隔列/隔帧绘制”。

### Upgrade plan (disabled by default)
- 若仍不达标，再评估 OffscreenCanvas + Worker 或 WebGL 方案（需单独变更提案）。

## Decisions
- Decision: 采用“低分辨率缓冲 + 帧率上限 + 可见性暂停”的组合拳，优先最小改动与可控参数。
- Alternatives considered:
  - WebGL Shader：性能好但复杂度高，超出当前范围。
  - 纯 CSS 背景动画：实现简单但随机性弱、观感偏静态。

## Risks / Trade-offs
- 视觉颗粒感与密度略变；通过 `scale` 与列间距微调保持氛围。
- 不同设备 GPU 计量方式差异；需要明确验证环境与时间窗口。

## Assumptions
- GPU 预算以“macOS + Chrome Task Manager 的 GPU process”作为基准测量。
