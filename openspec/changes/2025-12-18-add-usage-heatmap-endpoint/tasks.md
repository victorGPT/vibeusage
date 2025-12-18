# 2025-12-18-add-usage-heatmap-endpoint 任务清单

> 目标：把热力图“口径与派生算法”提升到 InsForge2 Edge Function，前端只做渲染；并保持对现有 endpoint 的向后兼容（可回退）。

## 1) Contract freeze（先定接口）

- [ ] 确认 query 参数：`weeks`/`to`/`week_starts_on` 的默认值与允许范围
- [ ] 确认 response shape：`from/to/weeks/thresholds/streak_days`（是否需要返回 `active_days`）
- [ ] 写入一份固定的样例 JSON（作为后续验收依据）

## 2) Backend（InsForge2 edge function）

- [ ] 新增 `insforge-functions/vibescore-usage-heatmap.js`（GET）
- [ ] 用 `auth.getCurrentUser()` 获取 `userId`，从 `vibescore_tracker_daily` 读取 `day,total_tokens`
- [ ] 派生：range 对齐、缺失补零、阈值分位数、level 映射、streak_days
- [ ] 参数限制：`weeks` 上限、非法 `to` 返回 400

## 3) Frontend（平滑切换）

- [ ] 更新 `dashboard/src/hooks/use-activity-heatmap.js`：优先调用 `/functions/vibescore-usage-heatmap`
- [ ] 若新 endpoint 404/不可用：回退调用 `/functions/vibescore-usage-daily` + 本地派生（保持旧能力）
- [ ] 仅渲染：`dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx` 不做 fetch

## 4) Tests / Verification

- [ ] 单测：派生算法与参数归一化（确定性输入输出）
- [ ] smoke：用现有 `scripts/smoke/insforge-smoke.cjs` 扩展验证 heatmap endpoint（可选项）
- [ ] 手工回归步骤：Dashboard 首页 heatmap 显示、无数据提示、范围显示正确

## 5) OpenSpec

- [ ] 更新 `openspec/changes/<id>/specs/vibescore-tracker/spec.md`（新增 backend heatmap requirement）
- [ ] `openspec validate 2025-12-18-add-usage-heatmap-endpoint --strict`

