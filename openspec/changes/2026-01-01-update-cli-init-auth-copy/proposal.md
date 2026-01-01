# Change: Update CLI init post-consent copy flow (Local → Report → Auth → Success)

## Why
当前 `init` 在完成本地配置后直接进入授权提示，用户缺少“本地已完成哪些配置”的确定性反馈。需要先展示本地配置结果，再进入联网注册，以提升掌控感与转化。

## What Changes
- 调整 `init` 在用户确认后的输出顺序：本地配置 → 透明报告 → 明确过渡到注册 → 授权指引 → 成功提示。
- 抽离“安装流程 copy deck + 渲染器”为独立模块，集中管理文案与阶段输出。
- 成功提示中展示可访问的 Dashboard 地址（优先解析本地或 `VIBESCORE_DASHBOARD_URL`）。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `src/commands/init.js`, `src/lib/cli-ui.js`, `src/lib/init-flow.js` (new)
- Affected tests: add CLI output regression under `test/`
- Docs: none
