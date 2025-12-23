# Runbook: Dashboard Idle GPU Spike Investigation

## 0. 复现前准备
- **浏览器**：Chrome（建议最新稳定版）。
- **页面**：
  - Dashboard（登录态或 `?mock=1`）。
  - Landing（未登录或登出）。
- **模式**：分别在本地 `npm run dashboard:dev` 与线上环境测一次，避免“仅 dev”偏差。

## 1. Baseline（不做任何干预）
1) 打开 Chrome Task Manager，记录 GPU Process（平均与突刺峰值）。
2) 前台静置 60s，记录突刺频率与幅度。
3) Performance 面板录制 30s（勾选 Screenshots、Memory、Web Vitals）。
4) 对 Landing 重复同样操作。

**记录模板**
- 环境：本地/线上
- 页面：Dashboard/Landing
- GPU 平均：
- GPU 峰值：
- 突刺周期：
- Trace 文件：

## 2. Isolation Matrix（不改代码，仅 DevTools 覆盖）
> 逐项施加，记录每一步的 GPU 变化。

### 2.1 禁用全部 CSS 动画与过渡
在 Console 执行：
```
const style = document.createElement('style');
style.id = 'vs-disable-anim';
style.textContent = '* { animation: none !important; transition: none !important; }';
document.head.appendChild(style);
```
记录 GPU 变化。

### 2.2 禁用模糊与阴影
在 Console 执行：
```
const style = document.createElement('style');
style.id = 'vs-disable-fx';
style.textContent = '* { backdrop-filter: none !important; filter: none !important; box-shadow: none !important; text-shadow: none !important; }';
document.head.appendChild(style);
```
记录 GPU 变化。

### 2.3 暂停定时器驱动组件（重载后生效）
在 Console 执行后刷新页面：
```
window.__vs_originalSetInterval = window.setInterval;
window.setInterval = () => 0;
```
记录 GPU 变化。

> 注意：该步骤会影响后台健康探测与时间显示，仅用于排查。

### 2.4 临时隐藏 ActivityHeatmap（排查 wheel 警告来源）
在 Elements 里找到热力图滚动容器（`aria-label` 对应 heatmap 文案），临时加 `style="display:none"`。
若警告消失或 GPU 明显下降，说明热力图滚轮映射/滚动区域是主要贡献因子。

### 2.5 禁用 rAF（验证是否存在持续 rAF 热点）
在 Console 执行后刷新页面：
```
window.__vs_originalRaf = window.requestAnimationFrame;
window.requestAnimationFrame = () => 0;
```
记录 GPU 变化。

## 3. Landing vs Dashboard 差异组件（重点怀疑区）
### 仅 Dashboard 有的长期活跃区域
- `DashboardPage` 每秒更新时间（全树重渲染）。
- `BackendStatus` + `ConnectionStatus`（150ms interval + `animate-pulse`）。
- 大量 `AsciiBox` / `SystemHeader` 的 `backdrop-blur` 与透明层叠加。
- `TrendMonitor`（多层叠加 + 动态高亮）。
- `ActivityHeatmap`（大量节点 + 滚动/吸附逻辑）。
- `IdentityCard` 内的 `matrix-scanlines` / `matrix-scan-sweep` 无限动画。

### Landing 特有但更轻量
- `LiveSniffer`（1500ms 更新）。
- `DecodingText`（短期动画，完成后停止）。

## 4. 证据与结论
- 贴出 GPU 平均/峰值、突刺周期、对应 Trace。
- 给出 Top 1~2 贡献源与修复建议。
