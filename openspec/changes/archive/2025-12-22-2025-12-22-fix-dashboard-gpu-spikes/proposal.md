# Change: Reduce dashboard GPU spikes without removing core visuals

## 结论
基于排查证据（禁用模糊/阴影约降 25%，关闭代码雨+模糊约降 30%，动画开关无显著变化），采用“削减大面积模糊/阴影 + 收敛代码雨成本”的最小改动方案，在保留 Matrix 风格与代码雨的前提下压低 GPU 突刺。

## Why
- Dashboard 空闲静置仍出现 GPU 突刺，线上也复现。
- 证据表明 `backdrop-filter`/阴影是主要贡献因子，代码雨为次要因子。
- 需要在不移除核心视觉（代码雨、Matrix 风格）的前提下降低 GPU 负担。

## What Changes
- 移除/替换大面积容器上的 `backdrop-filter`（如 `AsciiBox`、`SystemHeader` 等），改为更高不透明度的纯色叠层。
- 收敛大面积阴影强度与范围（减少大半径阴影与高强度 glow）。
- 进一步下调 `MatrixRain` 的帧率与内部渲染比例（仍保持全屏动态效果）。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: 
  - `dashboard/src/ui/matrix-a/components/AsciiBox.jsx`
  - `dashboard/src/ui/matrix-a/components/SystemHeader.jsx`
  - `dashboard/src/ui/matrix-a/components/TrendMonitor.jsx`
  - `dashboard/src/ui/matrix-a/components/MatrixRain.jsx`
  - `dashboard/src/ui/matrix-a/components/MatrixAvatar.jsx`（若需要收敛高光）
- 风险：视觉“磨砂感”减弱；通过提高纯色透明层和边框保持氛围。
