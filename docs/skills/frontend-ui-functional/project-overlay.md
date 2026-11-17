# Frontend UI Functional - Project Overlay

## Scope

This overlay applies when using the `frontend-ui-functional` skill in this repository.

## Required Rules

- **Project rules first:** Read `CLAUDE.md` before starting. Project-level rules override the base skill.
- **Copy registry:** All user-facing text must come from `dashboard/src/content/copy.csv`. Update the registry and run `npm run validate:copy` after changes.
- **UI hardcode guardrails:** Run `npm run validate:ui-hardcode` before shipping UI changes.
- **Reuse UI primitives:** Prefer the VU-1 blocks in `dashboard/src/ui/vu1` and the SPEC-01 kit in `dashboard/src/ui/hardware` before creating new ones. `dashboard/DESIGN.md` lists them.
- **Pages and layouts:** Pages in `dashboard/src/pages` hold only layout containers and component references. Styling belongs in components.
- **Tokens and styles:** Tailwind v4 has no config file. Layout tokens (the s1..s8 spacing scale and the 12-column grid) live in `dashboard/src/styles/vu1.css`; colors live in the kit and `ui/vu1` CSS.

## Mandatory Checks (Before PR)

- **Design guardrail:** run `npm --prefix dashboard run guardrail:design` (`dashboard/scripts/check-design-ssot.mjs`). It fails on a literal color or radius anywhere outside `dashboard/src/styles/tokens.css`, and on spacing off the s1..s8 scale and `text-[Npx]` outside the kit.
- **Copy registry validation:** run `npm run validate:copy`.

## Notes

- If you add or change copy keys, ensure the website content stays in sync with the copy registry.
