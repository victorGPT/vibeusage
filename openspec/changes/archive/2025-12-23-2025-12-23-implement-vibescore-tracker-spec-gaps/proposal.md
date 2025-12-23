# Change: Implement remaining vibescore-tracker spec gaps

## Why
当前 `openspec/specs/vibescore-tracker/spec.md` 已更新为真实口径，但仍缺少“需求到实现/验证”的闭环证据。需要系统性对齐，避免规范与实现长期漂移。

## What Changes
- Add a spec-level requirement to keep a requirement-to-evidence compliance map.
- 建立 requirement → 实现/证据映射表，明确每条需求的实现位置与验证方式。
- 识别并分级缺口（未实现/无验证/行为不一致），产出可执行的修复清单。
- 在确认优先级后逐项修复，并补齐最小可重复验证。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/**`, `insforge-src/**`, `src/**`, `scripts/**`
