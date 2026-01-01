# Change: Update CLI install flow copy + consent-first UX

## Why
- The current init output is verbose, engineering-heavy, and exposes internal paths early.
- We need explicit user consent before any local writes.
- A brand-consistent, low-noise flow reduces cognitive load during onboarding.

## What Changes
- Add a consent-first menu before any filesystem changes (Yes, configure my environment / No, exit).
- Suppress verbose logs during setup; show a single spinner instead.
- Emit a structured “Transparency Report” summary after setup (updated vs skipped integrations).
- Provide an explicit “Final Step” for account linking (press Enter to open browser).
- Replace raw background sync spawn errors with a non-fatal user-facing warning.
- Add `--yes` (skip prompts) and `--dry-run` (preview changes) options.

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/commands/init.js`, `src/cli.js`, CLI acceptance scripts/tests, README install docs, (optional) dashboard install copy.
- Dependencies: optional add `prompts`, `ora`, `boxen` (if approved).

## Architecture / Flow
- Phase 1: Consent menu shown before any writes.
- Phase 2: Spinner while setup runs (no noisy logs).
- Phase 3: Summary of integrations updated/skipped + next step to link account.
- Phase 4: Success box after auth or link-code completion.

## Risks & Mitigations
- Risk: Non-interactive environments block on prompts → Mitigation: `--yes` + auto-proceed when stdin is not TTY.
- Risk: Tests/acceptance scripts hang → Mitigation: pass `--yes` in scripts, add non-interactive test coverage.
- Risk: Misleading labels → Mitigation: align summary labels with actual integrations (Codex/Every Code/Claude/Gemini/Opencode).

## Rollout / Milestones
- M1: OpenSpec change validated; UX copy agreed.
- M2: CLI init flow refactor + tests updated.
- M3: Manual smoke for init + link-code + no-auth path.
