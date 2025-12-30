# Test Strategy

## Objectives
- Validate Gemini hook install/remove behavior and notify invocation.
- Preserve existing hooks and keep init/uninstall idempotent.

## Test Levels
- Unit: Gemini hooks config merge/remove and command builder.
- Integration: `init`/`uninstall` against temp `HOME` + `GEMINI_HOME`.
- Regression: Codex/Every Code/Claude/Opencode hook paths remain intact.
- Performance: not applicable (hook uses existing non-blocking notify handler).

## Test Matrix
- Requirement -> Test Level -> Owner -> Evidence
- SessionEnd hook install safe -> Integration -> CLI -> `test/init-uninstall.test.js`
- Uninstall removes only tracker hook -> Integration -> CLI -> `test/init-uninstall.test.js`
- Missing config skipped -> Unit/Integration -> CLI -> new test or acceptance script
- Notify handler gemini non-chaining -> Unit/Integration -> CLI -> new test or manual verification
- Status/diagnostics reflect gemini -> Integration -> CLI -> status/diagnostics test

## Environments
- Local Node test environment with temp `HOME` + `GEMINI_HOME`.

## Automation Plan
- Extend Node tests under `test/`.
- Add acceptance script under `scripts/acceptance/`.

## Entry / Exit Criteria
- Entry: requirements + acceptance approved.
- Exit: tests pass and acceptance script run.

## Coverage Risks
- Gemini CLI schema changes may require updates after real-world validation.
