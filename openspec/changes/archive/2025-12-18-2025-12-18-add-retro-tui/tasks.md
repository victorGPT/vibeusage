# 2025-12-18-add-retro-tui 任务清单

## M1：TUI 主题基础（CSS tokens + 可降级特效）

- [x] `dashboard/src/styles.css`：定义 TUI 主题变量（字体/颜色/边框/阴影/对齐）
- [x] CRT overlay：scanlines/glow/noise（默认开启；`prefers-reduced-motion` 自动降级）
- [x] 交互可用性：focus ring、hover/active、disabled 状态在深色主题下清晰可辨

## M2：页面框架（窗口化布局）

- [x] 页面框架：标题栏（App title + auth 状态）+ 主窗口区 + 底部状态/帮助栏
- [x] `Dashboard` 主页面：将“install / filters / metrics / sparkline / table”改为窗口化排版（仍保持鼠标交互）
- [x] 响应式：小屏下自动折叠/堆叠，不出现横向溢出（除非表格）

## M3：/connect 统一主题

- [x] `/connect` 页面使用同一框架与组件风格（按钮/提示/错误态）
- [x] “redirect URL 无效”错误提示在复古主题下仍清晰可读

## M4：界面与数据解耦（为后续换主题做准备）

- [x] 抽离纯逻辑到 `dashboard/src/lib/**`（config/auth/url/format/date-range/daily/http）
- [x] 抽离状态到 hooks：`dashboard/src/hooks/use-auth.js`、`dashboard/src/hooks/use-usage-data.js`
- [x] UI 组件化：`dashboard/src/components/**` + `dashboard/src/pages/**`，`dashboard/src/App.jsx` 仅负责路由分发
- [x] CSS 分层：`dashboard/src/styles/base.css` + `dashboard/src/styles/themes/matrix.css`，`dashboard/src/styles.css` 作为入口

## 验收与验证

- [ ] 手工验收：Chrome/Safari 下视觉一致；`prefers-reduced-motion` 生效（无闪烁/强动效）
- [ ] 冷回归：登录回调 `/auth/callback`、`/connect`、usage 查询与当前行为一致
- [x] 构建：`npm --prefix dashboard run build` 通过
