# Change: Investigate dashboard idle GPU spikes

## 结论
Dashboard 在空闲静置时仍出现 GPU 突刺，Landing 较轻但同样存在，且线上环境也会复现。需要建立可重复的排查路径（基线测量 → 组件/特效隔离 → 证据采集 → 根因归类），输出可复现的根因证据与最小化修复建议。

## Why
- GPU 突刺影响体验与性能预算，且与 MatrixRain 无关。
- 线上与本地均复现，说明不是单一环境问题。
- 当前缺少可复现的定位手册与证据链。

## What Changes
- 建立 Dashboard GPU 突刺的排查 runbook（含指标、工具与步骤）。
- 对 Dashboard 与 Landing 进行对照分析，明确差异来源。
- 通过可控隔离实验（禁用/替换视觉效果与动画）定位主要贡献因子。
- 输出根因结论与修复选项（不在本提案内实现）。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/**`（仅排查与潜在修复建议）
- 风险：若不定位根因，后续优化可能误伤视觉一致性或引入新回归
