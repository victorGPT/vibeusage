# 2025-12-18-add-usage-heatmap-endpoint 任务清单

> 目标：把热力图“口径与派生算法”提升到 InsForge2 Edge Function，前端只做渲染；并保持对现有 endpoint 的向后兼容（可回退）。

## 1) Contract freeze（先定接口）

- [x] 确认 query 参数：`weeks`/`to`/`week_starts_on` 的默认值与允许范围
- [x] 确认 response shape：`from/to/weeks/thresholds/streak_days`（包含 `active_days`）
- [x] 写入一份固定的样例 JSON（作为后续验收依据）

Contract freeze（已确认）：
- `week_starts_on` 默认：`sun`（与 GitHub 风格一致）
- `weeks` 默认：`52`；范围：`1..104`（上限两年）
- `to` 默认：today(UTC)（格式 `YYYY-MM-DD`；非法返回 400）

样例（截断）：
```json
{
  "from": "2025-12-07",
  "to": "2025-12-18",
  "week_starts_on": "sun",
  "thresholds": { "t1": "10", "t2": "100", "t3": "100" },
  "active_days": 4,
  "streak_days": 1,
  "weeks": [
    [
      { "day": "2025-12-07", "value": "0", "level": 0 }
    ]
  ]
}
```

## 2) Backend（InsForge2 edge function）

- [x] 新增 `insforge-functions/vibescore-usage-heatmap.js`（GET）
- [x] 用 `auth.getCurrentUser()` 获取 `userId`，从 `vibescore_tracker_daily` 读取 `day,total_tokens`
- [x] 派生：range 对齐、缺失补零、阈值分位数、level 映射、streak_days
- [x] 参数限制：`weeks` 上限、非法 `to` 返回 400
- [x] 部署：创建并启用 `vibescore-usage-heatmap`（InsForge2 edge function）

## 3) Frontend（平滑切换）

- [x] 更新 `dashboard/src/hooks/use-activity-heatmap.js`：优先调用 `/functions/vibescore-usage-heatmap`
- [x] 若新 endpoint 404/不可用：回退调用 `/functions/vibescore-usage-daily` + 本地派生（保持旧能力）
- [x] 仅渲染：`dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx` 不做 fetch

## 4) Tests / Verification

- [x] 单测：派生算法与参数归一化（确定性输入输出）
- [x] smoke：用现有 `scripts/smoke/insforge-smoke.cjs` 扩展验证 heatmap endpoint（可选项）
- [ ] 手工回归步骤：Dashboard 首页 heatmap 显示、无数据提示、范围显示正确

## 5) OpenSpec

- [x] 更新 `openspec/changes/<id>/specs/vibescore-tracker/spec.md`（新增 backend heatmap requirement）
- [x] `openspec validate 2025-12-18-add-usage-heatmap-endpoint --strict`
