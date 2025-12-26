# Milestones

## M1: Spec + plan ready
- Entry: OpenSpec change folder created
- Exit: proposal, requirements, acceptance criteria, test strategy, milestones, tasks, spec delta drafted
- Artifact: `openspec/changes/2025-12-26-add-gemini-cli-usage/*`

## M2: Tests written (RED)
- Entry: M1 complete
- Exit: Gemini parser tests added and failing as expected
- Artifact: updated `test/rollout-parser.test.js` (or new test file)

## M3: Implementation (GREEN)
- Entry: M2 complete
- Exit: Gemini parser + sync integration passes tests
- Artifact: updated `src/lib/rollout.js` and `src/commands/sync.js`

## M4: Regression + verification
- Entry: M3 complete
- Exit: regression tests executed and recorded
- Artifact: verification report updated with commands + outputs
