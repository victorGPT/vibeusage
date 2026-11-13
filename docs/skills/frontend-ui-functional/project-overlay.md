# Frontend UI Functional - Project Overlay

## Scope

This overlay applies when using the `frontend-ui-functional` skill in this repository.

## Required Rules

- **Project rules first:** Read `CLAUDE.md` before starting. Project-level rules override the base skill.
- **Copy registry:** All user-facing text must come from `dashboard/src/content/copy.csv`. Update the registry and run `npm run validate:copy` after changes.
- **UI hardcode guardrails:** Run `npm run validate:ui-hardcode` before shipping UI changes.
- **Reuse UI primitives:** Prefer existing components in `dashboard/src/ui/2049/base`, `dashboard/src/ui/2049/blocks` and `dashboard/src/ui/shadcn` before creating new ones. `dashboard/DESIGN.md` lists them.
- **Pages and layouts:** Pages in `dashboard/src/pages` hold only layout containers and component references. Styling belongs in components.
- **Tokens and styles:** Tailwind v4 has no config file. Tokens live in CSS `@theme` blocks. Use the 2049 tokens in `dashboard/src/styles/2049.css`. The v1 theme in `dashboard/src/styles.css` is only for the leftover v1 pages.

## Mandatory Checks (Before PR)

- **Design guardrail:** run `npm --prefix dashboard run guardrail:design` (`dashboard/scripts/check-design-ssot.mjs`). It fails on literal colors and off-scale spacing in 2049 files.
- **Copy registry validation:** run `npm run validate:copy`.

## Notes

- If you add or change copy keys, ensure the website content stays in sync with the copy registry.
