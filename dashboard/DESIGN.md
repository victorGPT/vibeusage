# VibeUsage Design System: VU-1

Every page is one VU-1 device built from the SPEC-01 hardware kit (spec-01.vercel.app, MIT, by Shu Ding): a light gray panel, IBM Plex Mono, a red key color, dark screens and gray LCD lists. When this file and the CSS disagree, the CSS wins. Fix this file.

## 1. Sources

- `src/ui/hardware/` is the SPEC-01 kit, installed with `npx shadcn add` from the registry JSON. `LICENSE` beside it carries the MIT notice. Its styles live in `src/ui/hardware/hardware/`, entered through `skin.css`. Everything in them is scoped to `[data-skin="hardware"]`.
- `src/ui/vu1/` holds the VU-1 blocks the pages are built from, their styles in `src/ui/vu1/blocks.css` and `src/ui/vu1/landing.css`, and the data helpers (`types.ts`, `format.ts`, `derive.ts`, `rank.ts`, `grouping.ts`).
- `src/styles/tokens.css` holds every color and radius value, and the type scale. `src/styles/vu1.css` holds the spacing tokens and the IBM Plex Mono faces. `src/styles.css` imports Tailwind, `vu1.css` and `tokens.css`.
- `src/Shell.jsx` is the one `<Hardware>` root. `src/main.jsx` wraps the router in it, so every route renders inside the skin with the toast stack beside it. Pages never add their own root.

## 2. Layout

The layout speaks for itself. Group with the grid and with distance, never with borders, fills or rules.

- **Grid.** Pages use `grid-page`, 12 columns with a fixed gutter. Inside a device, `grid-device` lays the parts (screen, period and source segments, keys, the row of minis, the lists) on the same 12 column lines, so every row starts and ends on the same two outer lines.
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
- **Roles.** `--spacing-inset` (s4) is a container's padding, the same on all four sides. `--spacing-stack` (s2) is the gap inside a group. `--spacing-section` (s5) is the gap between groups. They are utilities too (`p-inset`, `gap-stack`, `mt-section`). Blocks adopt them as they are rebuilt (VU2-P3/P4); today's mixed paddings, such as the top bar's `s3 s5`, stay until then.
- **Gutters.** `--spacing-gutter` is s5 (24px) and drops to s4 (16px) at 760px and below. `--spacing-gutter-device` is s4. `--container-shell` (`max-w-shell`) caps the page at 1200px.
- **390 wide.** At 760px and below the grid collapses to one column. Spacing still comes from the scale and the page never scrolls sideways.

## 3. Color and radius

Every color and radius value is written once, in `src/styles/tokens.css`. Everything else, the kit included, uses `var()`. Colors and radii never go in a className.

- **Palette.** `--palette-<hue>-<L>` is a color named by its OKLCH lightness times 1000 within a hue family (`gray`, `red`, `orange`, `yellow`, `green`, `blue`), so near-equal colors sit next to each other in the file. `--palette-white` and `--palette-black` are the extremes. `-aN` is the same color at N% opacity (`p` for a decimal point: `a2p5` is 2.5%). `-rgb` is a color's channels, for an opacity worked out in place: `rgb(var(--palette-black-rgb) / calc(0.3 * var(--shadow-k)))`. The palette keeps the kit's values exactly; merging near-equal ones is a visible change and belongs to a later ticket.
- **Roles.** Blocks use roles, not the palette: `--color-surface` (the kit's `--paper`), `--color-body` (`--panel`), `--color-ink`, `--color-legend`, `--color-accent` and `--color-accent-hi`, `--color-screen-ink` and `--color-screen-dim` on dark screens, `--color-lcd-ink` and `--fill-lcd` on the gray LCDs.
- **Key.** The key color is the kit's `--key-color`, worked out in `src/ui/hardware/hardware/tokens.css` from the theme (OKLCH 0.64 / 0.31 / 48) passed to `<Hardware>` in `src/Shell.jsx`. Primary keys, the current page LED and the user's own row use it.
- **Radius.** `--radius-N` is N px times `--corner-scale`, which is 1, or 2 where the browser draws squircle corners (`@supports (corner-shape: squircle)`): a squircle needs about twice the radius to look as round. `--radius-fixed-N` stays N px, for corners kept circular. The scale holds the kit's values, 1 to 75 px; folding it to six steps changes corners visibly and belongs to a later ticket.
- **Nesting.** An inner corner is the outer radius less the padding between them, so the gap is even round the corner. Write the padding as a variable on the outer part and subtract it: the display bezel sets `--bezel-inset` and its screen takes `calc(var(--radius-14) - var(--bezel-inset))`.

## 4. Type

One family, IBM Plex Mono, self-hosted as latin woff2 in weights 200, 300, 400 and 500 (`src/styles/vu1.css`). The kit's `--sans` and `--mono` both resolve to it.

- Printed labels carry `data-vu1-cap`: 10px, upper case, 0.12em tracking, tabular figures.
- The Landing title is `data-vu1="hero-title"` in `src/ui/vu1/landing.css`, weight 300.
- Sizes belong to the kit and the VU-1 CSS. A className never sets a font size.
- **Scale.** `src/styles/tokens.css` defines `--font-size-label` (11px), `--font-size-body` (12px), `--font-size-title` (16px) and `--font-size-readout` (20px). Functional text, meaning legends, table headers and key names, is never below `--font-size-label`. The kit's `--label` (key names, page keys, tooltips) is `--font-size-label` too. `npm --prefix dashboard run audit:ui` (in `ci:local` and CI) fails on any visible text below it, and on a device whose content leaves its one left and one right line.

## 5. Components

Pages arrange blocks on the grid and pass data. They do not style text, draw borders or pick colors. If a page needs a new look, change a block.

### Kit (`src/ui/hardware/`)

`hardware.tsx` (the skin root), `device.tsx`, `display.tsx`, `lcd.tsx`, `bar-graph.tsx`, `button.tsx`, `button-group.tsx`, `icon.tsx`, `slide-switch.tsx`, `segmented-control.tsx`, `item-list.tsx`, `pagination.tsx`, `tabs.tsx`, `toaster.tsx`, `code-block.tsx` and `skeleton.tsx`. `lib/` holds the page-wide behaviors the root installs once: haptics, key sounds, keyboard-only focus rings and the block caret.

### VU-1 blocks (`src/ui/vu1/`)

- `TopBar` carries the brand, page navigation, the GitHub star count, sign in or out and the key-sound switch.
- `UsageScreen` is the dark screen with the USAGE and ACTIVITY tabs, three readouts, the bar chart and the 52-week LED heatmap (arrow keys walk the days).
- `Segment` with `periodOptions()` is the period choice, `SourceSegment` the source choice, and `StatMinis` the four minis under the screen.
- `ModelList` and `RankScreen` are the gray LCD lists. `MyRankLcd` and `Pager` sit beside the board.
- `InstallCommand`, `Keys` (Share and Install), `IdentityStrip`, `UpgradeToast` and `StateScreen` (loading, empty, error, crash, signed out, install, expired, invalid) cover the rest.
- `ClientList` and `GlobalMeter` are Landing only.

Blocks format and derive. They never fetch.

### Kit patches

The kit's colors and radii are tokens (section 3), so a rerun of `npx shadcn add` would bring literals back and fail the guardrail. Beyond that, it keeps these edits, each marked `vibeusage patch` in the file:

- `src/ui/hardware/lib/sound.ts` and `src/ui/hardware/lib/haptics.ts` start with key sounds and haptics off.
- `src/ui/hardware/hardware/hardware-textures.css` points at the noise tiles in `src/ui/hardware/hardware/textures/` instead of embedding them as base64, so the render-blocking CSS stays small.
- `src/ui/hardware/hardware/skin.css` leaves out the accordion, dials, dpad, navbar and wheel sheets, which nothing renders.

## 6. Component semantics

Pick a component by what the content means, not by how it looks, and give one meaning one component everywhere: the period is chosen with the same Segmented on the Dashboard and on the Leaderboard. The split follows Radix and Carbon: choosing, acting, reading, listing and telling. Each component below says what it is for, when to use it, one Do and one Don't. `/__vu1` shows the pairs side by side with real components (`src/ui/gallery/DoDontVu1.tsx`), and a test fails when a pair has no subsection here.

| Meaning | Component | Use |
| --- | --- | --- |
| One of 2 to 5 options | Segmented | `Segment` in `src/ui/vu1/SourceSegment.tsx` |
| One of more than 5 ordered steps | SlideSwitch | `src/ui/hardware/slide-switch.tsx` (a continuous value has no component yet) |
| An action | Keys | `ShareKey` and `InstallKey` in `src/ui/vu1/Keys.tsx`, `Button` in `src/ui/hardware/button.tsx` |
| Views of one screen | Tabs | the tabs in `src/ui/vu1/UsageScreen.tsx` |
| A few headline readings and a chart | UsageScreen | `src/ui/vu1/UsageScreen.tsx` |
| One or two readings in a row, such as the reader's rank | MyRankLcd | `src/ui/vu1/MyRankLcd.tsx` |
| A label and its value | Mini | `src/ui/vu1/StatMinis.tsx` |
| Rows that share columns | Table | `src/ui/vu1/ModelList.tsx`, `src/ui/vu1/RankScreen.tsx` |
| Pages of a table | Pager | `src/ui/vu1/Pager.tsx` |
| A hint, or an explanation few people need | Tooltip | `@ui-sdk/react/tooltip` with `data-kit="tooltip"`, styled by the kit; `KeyTip` in `src/ui/vu1/KeyTip.tsx` names an icon key |
| Nothing to show yet: loading, empty, error, signed out | StateScreen | `src/ui/vu1/StateScreen.tsx` |
| A message that comes and goes | Toast | `notify` in `src/ui/hardware/toaster.tsx`, `UpgradeToast` |

`Segment` always prints names on the keys and `ModelList` and `RankScreen` always have one frame; neither takes a prop for the old look. The `/__vu1` Don't pairs draw it with the kit's `Segmented` and a list inside the kit's `Lcd`. The kit's own `Segmented` (`src/ui/hardware/segmented-control.tsx`) is uncontrolled, the kit's `ItemList` is a selectable listbox, and the kit's `Lcd` and `Display` duplicate the VU-1 screens. They stay in the gallery and pages do not use them.

**One frame.** A surface (screen, LCD, mini) sits straight on the device panel with one frame. A surface never sits inside another surface's frame, and its padding is the same on all four sides.

### Segmented

- **Purpose.** Choose one of a few options that exclude each other; the choice applies at once.
- **When.** 2 to 5 short options, such as the period (Day, Week, Month, Total) or the source (All, Claude, Codex).
- **Do.** Print each option's name on its slot, at `--font-size-label` or larger, and size the control to its options, never past its column span; on a phone it fills its row with equal keys.
- **Don't.** Leave the slots blank with the names printed under them; it reads as a lever and people do not see where to press.

### SlideSwitch

- **Purpose.** Set one of many ordered steps by moving a lever.
- **When.** More than 5 steps. A continuous value has no component yet; add one when a page needs it.
- **Do.** Use a Segmented for 4 periods, the same one on every page that chooses a period.
- **Don't.** Use a SlideSwitch for 4 named options on one page and a Segmented for the same choice on another.

### Keys

- **Purpose.** Run an action.
- **When.** Share, install, copy, sign in, retry.
- **Do.** At most one primary (red) key in view; the others are secondary. An icon key prints its legend under it or shows a Tooltip.
- **Don't.** Two red keys side by side, or an icon key whose name is only in `aria-label`.

### Tabs

- **Purpose.** Switch between views of the same data in one screen.
- **When.** USAGE and ACTIVITY on the usage screen.
- **Do.** Keep the tabs in the screen's head and the readings the same across tabs.
- **Don't.** Use tabs to choose a filter such as the period or the source; that is a Segmented.

### UsageScreen

- **Purpose.** The dark screen: the period's headline readings and its chart.
- **When.** Once per Dashboard. One or two readings in a row, such as the reader's rank, go on `MyRankLcd`.
- **Do.** Give the bar chart one slot per unit of the period (7 for a week, the days of the month, the months of the total) and draw a dark slot for a unit with no usage.
- **Don't.** Give the chart one slot per row of data: a week with two active days turns into two wide slabs.

### Mini

- **Purpose.** One label and one value on a small gray LCD.
- **When.** Rolling figures under the screen: last 7 days, last 30 days, average, peak.
- **Do.** Four minis in one row on the device grid, label above value.
- **Don't.** Put label and value pairs in a table, or a mini inside another frame.

### Table

- **Purpose.** Rows that share columns: models, the leaderboard.
- **When.** More than one item with the same fields.
- **Do.** One frame on the panel with the same padding on all sides. A bar column (`data-fill` on its cells) takes the width the other columns leave, and its meter spans it.
- **Don't.** A bezel ring around the table's frame, so it reads as a box inside a box.

### Pager

- **Purpose.** Move through pages of a table.
- **When.** Under a table with more rows than one page.
- **Do.** Sit on the table's column lines: Previous on the left line, Next on the right line, the page keys centered between them.
- **Don't.** Arrow keys with no visible name or Tooltip.

### Tooltip

- **Purpose.** Hold text that most people do not need every time: what an icon key does, how a figure is counted.
- **When.** An icon key without a printed legend, or a description longer than a label.
- **Do.** Put the description behind a Tooltip on the label or key it explains.
- **Don't.** Print the description on the page by default.

### StateScreen

- **Purpose.** Fill the screen's place when there is nothing to show.
- **When.** Loading, empty, error, crash, signed out, install, expired, invalid.
- **Do.** A title, at most one sentence, and at most one key.
- **Don't.** A paragraph of help, or a red key beside another red key on the page.

### Toast

- **Purpose.** Say that something happened, then go away.
- **When.** Copied, shared, a newer CLI is out.
- **Do.** One line, bottom right, with at most one key.
- **Don't.** Put anything in a toast that the reader must act on later.

### Text levels

Four levels, nothing between them. Functional text, meaning legends, column heads, key names and labels, is never below `--font-size-label` (11px).

| Level | Use | Size |
| --- | --- | --- |
| Page title | The Landing hero title, the only page title | its own size in `src/ui/vu1/landing.css` |
| Section title | The device's name line, a screen's tabs, a gallery caption | `--font-size-label`, upper case |
| Label | A reading's or mini's label, a column head, a key legend | `--font-size-label`, upper case |
| Description | A sentence that explains | `--font-size-body`, written, not spoken; in a Tooltip by default |

- **Do.** Keep the page title, the section titles and the label and value pairs; fold the rest into a Tooltip.
- **Don't.** Print 8 to 10px legends, or marketing lines and chatty help on the page.

## 7. Gallery

`/__vu1` is the dev-only gallery, registered in `src/main.jsx` when `import.meta.env.DEV`. `src/ui/gallery/GalleryVu1.tsx` shows every kit part in its rest, hover, pressed and focus states with the spacing scale and the grid. `src/ui/gallery/BlocksVu1.tsx` shows every VU-1 block with sample data, and `src/ui/gallery/DoDontVu1.tsx` shows the Do and Don't pairs of section 6. Production builds leave it out.

## 8. Guardrail

- `scripts/check-design-ssot.mjs` runs as `npm run guardrail:design` and before `npm test` in `dashboard/`, and from the repo root as `npm run validate:design`, the first step of `npm run ci:local` and of the CI workflow. Everywhere under `src/` except `src/styles/tokens.css`, the kit included, it fails on:
  - a literal color in a CSS value: hex, a named color, or `rgb()`, `hsl()`, `oklch()` and the like with number channels (a relative color, `oklch(from var(...) ...)`, or channels from `var()` is fine),
  - a length in a `*-radius` value other than 0 or 50%,
  - in JS and TS: a literal color, named colors included, in a `style={{...}}` value or an SVG color attribute (`fill`, `stroke`, `stopColor`, `floodColor`, `lightingColor`, `color`), and an inline `borderRadius` that is a length other than 0 or 50%.
- Under `src/`, except the kit in `src/ui/hardware/`, it also fails on:
  - a padding, margin, gap or space utility off the scale (`gap-5`, `p-[13px]`, `space-y-2`),
  - an inline `style` padding, margin or gap that is not 0 or a scale token, read across lines from `style={{` to the first `}}` (a nested `}}` inside the object would end the read early),
  - a CSS padding, margin or gap value that is not 0, `auto` or a scale token (the gutters, inset, stack and section count, since they alias scale steps; `0.5` is not 0),
  - a literal color, a `rounded-[...]` radius or a `text-[Npx]` size in a className.
- `scripts/ops/validate-ui-hardcode.cjs` runs as `npm run validate:ui-hardcode` from the repo root. It counts hex and rgb literals and raw JSX text per file under `dashboard/src` against `scripts/ops/ui-hardcode-baseline.json`.
- All user-facing text comes from `src/content/copy.csv` through `copy()`. Run `npm run validate:copy` after changing it.

## 9. Adding a token

Add a spacing token to `src/styles/vu1.css`, a color, radius or font size to `src/styles/tokens.css`, and say so in this file. Reuse a palette entry before adding one; a block reaches for a role (`--color-*`) before the palette. Do not hard-code a new value in a block.

## 10. Keyboard

`src/hooks/use-global-keybinds.ts` binds single keys on the Dashboard: `d`, `w`, `m` and `t` switch the period, `r` refreshes and `s` shares. Bindings use no modifier keys and are off while a text field has focus or in screenshot mode.
