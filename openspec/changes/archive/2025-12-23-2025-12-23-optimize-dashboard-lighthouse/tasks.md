## 1. Baseline & Diagnosis
- [x] 1.1 Run `vite preview` on `http://localhost:5173/` (strict port) for production-like measurements
- [x] 1.2 Capture Lighthouse desktop score for landing page `http://localhost:5173/` (3 runs, default desktop preset)
- [x] 1.3 Record DevTools Performance + Network traces for landing page
- [x] 1.4 Capture Lighthouse desktop score for signed-in dashboard `http://localhost:5173/` (3 runs, default desktop preset, authenticated or mock session)
- [x] 1.5 Record DevTools Performance + Network traces for dashboard
- [x] 1.6 List top bottlenecks (LCP, TBT, long tasks, heavy assets)

## 2. Optimization
- [x] 2.1 Reduce landing initial JS execution (code splitting, lazy-load non-critical modules)
- [x] 2.2 Defer or lower-cost non-critical visual effects while preserving Matrix UI A (landing)
- [x] 2.3 Optimize font/image loading if applicable (preload, size, format)
- [x] 2.4 Apply the same performance optimization standards to the signed-in dashboard
- [x] 2.5 Ensure no new UI copy is introduced outside `dashboard/src/content/copy.csv`

## 3. Verification
- [x] 3.1 Re-run Lighthouse desktop on landing page `http://localhost:5173/` (3 runs) and confirm score ≥ 95
- [x] 3.2 Re-run Lighthouse desktop on signed-in dashboard `http://localhost:5173/` (3 runs) and confirm score ≥ 95 (authenticated or mock session)
- [x] 3.3 Regression smoke check: landing renders and sign-in flow can be initiated from `/`
- [x] 3.4 Regression smoke check: dashboard renders and key panels are visible
- [x] 3.5 Record verification commands and results
