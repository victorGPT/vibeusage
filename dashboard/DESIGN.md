# VibeUsage Design System: VU-1

Every page is one VU-1 device built from the SPEC-01 hardware kit (spec-01.vercel.app, MIT, by Shu Ding): a light gray panel, IBM Plex Mono, a red key color, dark screens and gray LCD lists. When this file and the CSS disagree, the CSS wins. Fix this file.

## 1. Sources

- `src/ui/hardware/` is the SPEC-01 kit, installed with `npx shadcn add` from the registry JSON. `LICENSE` beside it carries the MIT notice. Its styles live in `src/ui/hardware/hardware/`, entered through `skin.css`. Everything in them is scoped to `[data-skin="hardware"]`.
- `src/ui/vu1/` holds the VU-1 blocks the pages are built from, their styles in `src/ui/vu1/blocks.css` and `src/ui/vu1/landing.css`, and the data helpers (`types.ts`, `format.ts`, `derive.ts`, `rank.ts`, `grouping.ts`).
- `src/styles/vu1.css` holds the layout tokens and the IBM Plex Mono faces. `src/styles.css` imports Tailwind and `vu1.css`.
- `src/Shell.jsx` is the one `<Hardware>` root. `src/main.jsx` wraps the router in it, so every route renders inside the skin with the toast stack beside it. Pages never add their own root.

## 2. Layout

The layout speaks for itself. Group with the grid and with distance, never with borders, fills or rules.

- **Grid.** Pages use `grid-page`, 12 columns with a fixed gutter. Inside a device, `grid-device` lays the parts (period switch, screen, keys, the row of minis, the lists) on the same 12 column lines, so their left and right edges line up.
- **Scale.** Spacing comes only from this 4px scale. Use the tokens (`p-s4`, `gap-s2`, `mt-s8`) or `var(--spacing-s1)` through `var(--spacing-s8)`. `0` and `auto` are fine. Nothing else is.

| Token | Value |
| --- | --- |
| `--spacing-s1` | 4px |
| `--spacing-s2` | 8px |
| `--spacing-s3` | 12px |
| `--spacing-s4` | 16px |
| `--spacing-s5` | 24px |
| `--spacing-s6` | 32px |
| `--spacing-s7` | 48px |
| `--spacing-s8` | 64px |

- **Distance is relation.** Space inside a group is at least one step smaller than space between groups, such as 8 inside and 24 between.
- **Gutters.** `--spacing-gutter` is s5 (24px) and drops to s4 (16px) at 760px and below. `--spacing-gutter-device` is s4. `--container-shell` (`max-w-shell`) caps the page at 1200px.
- **390 wide.** At 760px and below the grid collapses to one column. Spacing still comes from the scale and the page never scrolls sideways.

## 3. Color

Colors live in CSS, never in a className.

- The kit's palette is in `src/ui/hardware/hardware/tokens.css` and `src/ui/hardware/hardware/hardware.css`: `--paper`, `--panel`, `--ink`, `--dim` and `--key-color`.
- The key color is OKLCH 0.64 / 0.31 / 48, passed to `<Hardware>` in `src/Shell.jsx`. Primary keys, the current page LED and the user's own row use it.
- The VU-1 surfaces add their own tokens at the top of `src/ui/vu1/blocks.css`: `--vu1-red`, `--vu1-red-hi`, `--vu1-ink`, `--vu1-legend`, `--vu1-screen-ink`, `--vu1-screen-dim` and `--vu1-lcd-ink`.

## 4. Type

One family, IBM Plex Mono, self-hosted as latin woff2 in weights 200, 300, 400 and 500 (`src/styles/vu1.css`). The kit's `--sans` and `--mono` both resolve to it.

- Printed labels carry `data-vu1-cap`: 10px, upper case, 0.12em tracking, tabular figures.
- The Landing title is `data-vu1="hero-title"` in `src/ui/vu1/landing.css`, weight 300.
- Sizes belong to the kit and the VU-1 CSS. A className never sets a font size.

## 5. Components

Pages arrange blocks on the grid and pass data. They do not style text, draw borders or pick colors. If a page needs a new look, change a block.

### Kit (`src/ui/hardware/`)

`hardware.tsx` (the skin root), `device.tsx`, `display.tsx`, `lcd.tsx`, `bar-graph.tsx`, `button.tsx`, `button-group.tsx`, `icon.tsx`, `slide-switch.tsx`, `segmented-control.tsx`, `item-list.tsx`, `pagination.tsx`, `tabs.tsx`, `toaster.tsx`, `code-block.tsx` and `skeleton.tsx`. `lib/` holds the page-wide behaviors the root installs once: haptics, key sounds, keyboard-only focus rings and the block caret.

### VU-1 blocks (`src/ui/vu1/`)

- `TopBar` carries the brand, page navigation, the GitHub star count, sign in or out and the key-sound switch.
- `UsageScreen` is the dark screen with the USAGE and ACTIVITY tabs, three readouts, the bar chart and the 52-week LED heatmap (arrow keys walk the days).
- `PeriodSwitch`, `SourceSegment` and `StatMinis` are the period switch, the source segment and the four minis under the screen.
- `ModelList` and `RankScreen` are the gray LCD lists. `MyRankLcd` and `Pager` sit beside the board.
- `InstallCommand`, `Keys` (Share and Install), `IdentityStrip`, `UpgradeToast` and `StateScreen` (loading, empty, error, crash, signed out, install, expired, invalid) cover the rest.
- `ClientList` and `GlobalMeter` are Landing only.

Blocks format and derive. They never fetch.

### Kit patches

The kit is kept as shipped except for these edits, each marked `vibeusage patch` in the file. Rerunning `npx shadcn add` overwrites them, so apply them again after an update.

- `src/ui/hardware/lib/sound.ts` and `src/ui/hardware/lib/haptics.ts` start with key sounds and haptics off.
- `src/ui/hardware/hardware/hardware-textures.css` points at the noise tiles in `src/ui/hardware/hardware/textures/` instead of embedding them as base64, so the render-blocking CSS stays small.
- `src/ui/hardware/hardware/skin.css` leaves out the accordion, dials, dpad, navbar and wheel sheets, which nothing renders.

## 6. Gallery

`/__vu1` is the dev-only gallery, registered in `src/main.jsx` when `import.meta.env.DEV`. `src/ui/gallery/GalleryVu1.tsx` shows every kit part in its rest, hover, pressed and focus states with the spacing scale and the grid. `src/ui/gallery/BlocksVu1.tsx` shows every VU-1 block with sample data. Production builds leave it out.

## 7. Guardrail

- `scripts/check-design-ssot.mjs` runs as `npm run guardrail:design` and before `npm test` in `dashboard/`, and from the repo root as `npm run validate:design`, the first step of `npm run ci:local` and of the CI workflow. Under `src/`, except the kit in `src/ui/hardware/`, it fails on:
  - a padding, margin, gap or space utility off the scale (`gap-5`, `p-[13px]`, `space-y-2`),
  - an inline `style` padding, margin or gap that is not 0 or a scale token, read across lines from `style={{` to the first `}}` (a nested `}}` inside the object would end the read early),
  - a CSS padding, margin or gap value that is not 0, `auto` or a scale token (the gutters count, since they alias s5 and s4; `0.5` is not 0),
  - a literal color or a `text-[Npx]` size in a className.
- `scripts/ops/validate-ui-hardcode.cjs` runs as `npm run validate:ui-hardcode` from the repo root. It counts hex and rgb literals and raw JSX text per file under `dashboard/src` against `scripts/ops/ui-hardcode-baseline.json`.
- All user-facing text comes from `src/content/copy.csv` through `copy()`. Run `npm run validate:copy` after changing it.

## 8. Adding a token

Add a layout token to `src/styles/vu1.css`, or a color to the top of `src/ui/vu1/blocks.css`, and to this file. Do not hard-code a new value in a block.

## 9. Keyboard

`src/hooks/use-global-keybinds.ts` binds single keys on the Dashboard: `d`, `w`, `m` and `t` switch the period, `r` refreshes and `s` shares. Bindings use no modifier keys and are off while a text field has focus or in screenshot mode.
