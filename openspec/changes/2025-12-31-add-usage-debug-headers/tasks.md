## 1. Implementation
- [x] 1.1 Add debug payload helper (threshold + duration + request id) gated by `debug=1`.
- [x] 1.2 Apply debug payload to usage endpoints (summary/daily/hourly/monthly/heatmap/model-breakdown).
- [x] 1.3 Rebuild `insforge-functions/` artifacts.
- [x] 1.4 Update backend docs for debug payload.

## 2. Tests
- [x] 2.1 Add unit test for debug payload on a usage endpoint.
- [x] 2.2 Run regression tests (at least the updated test file).
- [x] 2.3 Add acceptance script verifying debug payload gating.

## 3. Verification
- [x] 3.1 Verify debug payload appears only when `debug=1` and is absent otherwise.
