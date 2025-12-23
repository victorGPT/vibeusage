# Change: Optimize MatrixRain GPU budget without removing animation

## 结论
基于第一性原理（单位时间像素更新量与绘制次数决定 GPU 压力），在不移除动画、不给用户开关的前提下，通过“低分辨率渲染 + 帧率上限 + 隐藏暂停”的组合，把代码雨的常驻 GPU 使用率压到 <2%。

## Why
- 当前 MatrixRain 逐帧全屏重绘、无帧率上限，GPU 常驻负载高。
- 需求明确：动画必须保留、不能提供开关，但 GPU 需常驻 <2%。

## What Changes
- MatrixRain 使用低分辨率渲染缓冲并拉伸至全屏显示。
- 增加帧率上限（<= 12 fps）与可见性暂停（hidden 时不调度）。
- 适度降低列密度以减少 draw calls，同时维持视觉氛围。
- `prefers-reduced-motion` 在组件内部统一生效（Landing + Shell 一致）。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/ui/matrix-a/components/MatrixRain.jsx` (primary)
- 风险：密度与颗粒感变化；通过参数微调保持观感。
