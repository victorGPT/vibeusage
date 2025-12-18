# Change: Adopt Matrix UI A for Dashboard (based on `copy.jsx`)

## Why

我们要对 Dashboard 做一次“大改 UI”，并且未来还会继续更换/迭代 UI 风格。当前的风险点是：如果 UI 组件、数据获取、业务状态耦合在一起，任何一次风格替换都会引发连锁改动与不可控的紊乱。

因此本变更要达成两个目标：

1) **确认并补齐前端接口解耦与模块化**（数据层/状态层/视图层边界清晰），为后续 UI 风格迁移提供稳定地基。  
2) **以 `copy.jsx` 为“Matrix UI A”的视觉与组件蓝图**，将其拆分成可复用组件库，并把现有官网 Dashboard 的业务模块迁移到该视觉体系下。

## What Changes

- **现状审计**：检查 Dashboard 前端是否已实现“数据逻辑/状态/hooks/视图组件”分层；若不足，补齐分层与接口。
- **Matrix UI A 组件化**：将 `copy.jsx` 中的可复用块（例如 `AsciiBox`/`DataRow`/`TrendChart`/背景与叠层）抽离成组件库（可复用、可组合、可替换）。
- **业务模块映射与补齐**：
  - 官网有但 `copy.jsx` 没有的模块：基于已抽离的 Matrix UI A 组件风格，新增对应“同风格组件”。
  - `copy.jsx` 有但官网没有的模块：整理为可选模块，**由用户选择是否纳入**，并明确每个模块需要的数据接口。
- **页面迁移**：将 Dashboard 首页与 `/connect` 页面迁移到 Matrix UI A 视觉体系（交互仍保持标准 Web：鼠标点击、表单输入、链接跳转）。
- **可访问性与动效降级**：继续遵守 `prefers-reduced-motion`，避免持续闪烁/强动效；保持 focus/hover/disabled 状态可辨识。

## Module Scope (Chosen)

本次确认纳入的 `copy.jsx` 模块（IN）：

- BootScreen（开机屏）：纯前端展示，不依赖后端
- Activity heatmap（活动热力图）：基于现有 daily usage 数据派生（参考 GitHub contributions 的网格思路，我们自定义一套映射/阈值）
- Identity panel（身份面板）：优先使用登录信息（name/email/userId）；Rank 先做占位，后续再由后端补齐

本次暂不纳入（DEFER / OUT）：

- Network stat（网络状态）：你建议后续再考虑（本次先不做，避免引入不真实/误导的数据）
- Logs / Telemetry / Active nodes / Export card / 24h realtime：先不做

## Scope

### IN
- Dashboard UI 大改（Matrix UI A 视觉与布局）与组件库抽取
- 前端模块化与接口边界整理（为换皮稳定）
- `/connect` 页面统一视觉

### OUT
- 不新增后端能力/接口/鉴权面
- 不改变现有数据链路与行为（`/auth/callback`、usage 查询等契约保持）
- 不实现“真实终端 TUI 输入模型”（raw-mode / 光标导航 / 全键盘交互）

## Constraints / Non‑negotiables

- 交互逻辑必须保持现代 Web 行为（鼠标/点击/表单），只追求“看起来像 TUI/Matrix”。
- 必须尊重 `prefers-reduced-motion` 自动降级。
- 组件必须可复用、可组合，并具备清晰的数据接口（props）边界。
- CSS/样式落地策略需要先定稿：**直接引入 Tailwind 复用 `copy.jsx` 的 utility class**，或**将其翻译为语义化 class + theme CSS**（见 `design.md`）。
