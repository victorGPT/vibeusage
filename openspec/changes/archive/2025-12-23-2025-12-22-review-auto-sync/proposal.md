# Change: Review auto sync effectiveness and improve observability

## 结论
基于第一性原理，auto sync 是否“生效”取决于 **触发器（Codex notify）→ 后台 sync spawn → 解析/入队 → 上传节流** 这一链条是否连续。当前实现具备该链路，但缺少“可一键判断健康度”的可复现结论。建议先用诊断与证据确认“是否生效”，再视情况做最小化改进（状态提示与健康度判断），避免引入后台常驻机制。

## Why
- 用户反馈需要确认 auto sync 是否真正生效，并判断是否需要改善。
- 现有实现有节流与回退路径，但缺乏聚合性的健康信号（OK/DEGRADED）。

## What Changes
- 建立 auto sync 诊断与验证的 runbook（命令、信号与判定标准）。
- 规范“auto sync 健康度”的定义与阈值（如最近通知时间、队列积压、上传节流状态）。
- 若发现缺口，提出最小化改进（例如 `status` 输出健康提示），不引入新后台服务。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code (potential): `src/commands/status.js`, `src/lib/diagnostics.js`, `src/commands/sync.js`, `src/commands/init.js`
