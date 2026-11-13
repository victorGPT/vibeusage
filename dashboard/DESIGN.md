# VibeUsage Design System: 2049

This file describes the 2049 UI. Every page uses it except the few listed in section 10. The tokens live in `src/styles/2049.css`. The boards in `design/2049/` are the visual reference, and `design/2049/source/Main.dc.html` is the spec board the tokens follow. When this file and the CSS disagree, the CSS wins. Fix this file.

## 1. Sources

- `src/styles/2049.css` holds the tokens (`@theme`), the fonts, the state variants and the two screen utilities.
- `design/2049/README.md` explains the boards. `design/2049/source/*.dc.html` holds one board per component with exact inline values. The `page-*.png` and `spec-*.png` files are renders of the boards.
- `src/ui/2049/base/`, `src/ui/2049/blocks/` and `src/ui/shadcn/` hold the components. Most name their board in a `// SSOT:` comment. The dialogs, `Linked` and `UpgradeBanner` have no board.
- `src/ui/gallery/` is the dev-only gallery at `/__2049` (registered in `src/main.jsx` when `import.meta.env.DEV`). It renders the tokens, the controls and most blocks, with forced hover, active and focus cells.

## 2. Color

Dark only. Use the utility the token generates (`bg-card`, `text-hero`, `border-border`, `outline-ring`). Never write a literal color in a 2049 file.

| Token | Value | Use |
| --- | --- | --- |
| `--color-background` | `#03100f` | Page ground. |
| `--color-card` | `#061716` | Panel ground (`Card`, dialog). |
| `--color-accent` | `#0a2321` | Pressed fill (`is-active:bg-accent`). Hover uses `bg-card`. |
| `--color-border` | `#1f4e48` | Default 1px line and body table rules. |
| `--color-input` | `#2c6b63` | Control borders and the table header rule. |
| `--color-foreground` | `#bfe9e1` | Body text. |
| `--color-muted-foreground` | `#6fa79e` | Labels and secondary text. |
| `--color-hero` | `#e2f8f3` | Display numbers and headings. |
| `--color-primary` | `#e0b04a` | Amber. Primary action, current item, "me" row, meter fill. |
| `--color-primary-foreground` | `#03100f` | Text on amber. |
| `--color-destructive` | `#e5484d` | Errors and a falling delta. |
| `--color-ring` | `#e0b04a` | Focus ring. |
| `--color-teal` | `#7fd9cb` | Leader mark and teal glow. |
| `--color-screen-core` | `#0c2c29` | Center of the main-screen vignette. |
| `--color-screen-edge` | `#020807` | Edge of the main-screen vignette. |

Glow tokens are text shadows, not colors: `--text-shadow-display-glow` (teal), `-amber` and `-alert` for the `Display` number, and `--text-shadow-heading-glow` (teal) and `-amber` for the largest `Heading`. `--inset-shadow-screen` is the inner glow of the main screen.

## 3. Type

Three families, all self-hosted as latin woff2:

| Token | Family | Weights | Use |
| --- | --- | --- | --- |
| `--font-display` | Saira | 200, 300, 400 | Numbers, headings, table cells. |
| `--font-sans` | Barlow | 500, 600 | Body text and labels. |
| `--font-command` | JetBrains Mono | 500 | Shell commands (`CommandBox`). |

The spec board calls the mono family `--font-mono`. In code it is `--font-command`, because the leftover v1 pages still use `--font-mono` for Geist Mono (see section 10). Rename it when those pages move to 2049.

Size tokens set the font size only. Put the line height on the class, as in `text-label/none`, because one size carries several line heights across the boards. Do not use a separate `leading-*` utility. `cn()` drops it when it comes before a size token.

| Token | Size |
| --- | --- |
| `--text-badge` | 10px |
| `--text-label` | 11px |
| `--text-label-lg` | 12px |
| `--text-copy-s` | 14px |
| `--text-copy-m` | 15px |
| `--text-copy-l` | 17px |
| `--text-value-s` | 18px |
| `--text-heading-xs` | 22px |
| `--text-value-l` | 28px |
| `--text-heading-s` | 36px |
| `--text-heading-m` | 40px |
| `--text-title` | 44px |
| `--text-heading-l` | 52px |
| `--text-screen-s` | 64px |
| `--text-screen-m` | 72px |
| `--text-heading-xl` | 76px |
| `--text-screen-l` | 76px |
| `--text-screen-xl` | 88px |

`--tracking-label` (0.12em) is the letter spacing for upper-case labels.

## 4. Shape and space

Radius has three steps:

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` (`rounded-sm`) | 3px | Controls, badges, small marks. |
| `--radius-md` (`rounded-md`) | 8px | Panels (`Card`, dialog). |
| `--radius-lg` (`rounded-lg`) | 18px | The main screen (`ScreenFx`). |

Spacing uses Tailwind's 4px `--spacing`. Padding, margin, gap and space utilities may only use the steps 4, 8, 12, 16, 24, 32, 48 and 64 px (`-1 -2 -3 -4 -6 -8 -12 -16`). `scripts/check-design-ssot.mjs` fails on any other step in a 2049 file.

Fixed heights:

| Token | Utility | Value | Use |
| --- | --- | --- | --- |
| `--spacing-control` | `h-control` | 32px | Buttons, selects, toggles. |
| `--spacing-control-lg` | `h-control-lg` | 48px | The large button (`size="lg"`) in `LandingHero` and `CtaBand`. |
| `--spacing-row` | `h-row`, `min-h-row` | 40px | Table and list rows. |

## 5. Material

- `screen-shell` paints the main-screen vignette from `--color-screen-core` through `--color-card` to `--color-screen-edge`.
- `screen-scanlines` draws one dark line every 3px. It is static.
- `ScreenFx` combines both with the 18px radius, the border and `--inset-shadow-screen`. Use one per page, around its most important number.

## 6. States

`2049.css` defines three custom variants. Controls use them instead of `hover:`, `active:` and `focus-visible:`.

- `is-hover:` matches `:hover` on an enabled element.
- `is-active:` matches `:active` on an enabled element.
- `is-focus:` matches `:focus-visible`.

Each one also matches `data-force="hover"`, `"active"` or `"focus"`. The `/__2049` gallery sets that attribute to pin a state with the same classes the user sees. A disabled control keeps its variant look at reduced opacity. Some blocks still put plain `hover:` or `focus-visible:` on links and scroll areas. The gallery cannot pin those states.

## 7. Components

Pages hold only layout containers and component references. A page arranges blocks in a grid or stack and passes data. It does not style text, draw borders or pick colors. If a page needs a new look, add or change a component.

### Base (`src/ui/2049/base/`)

- `CommandBox` shows a shell command in JetBrains Mono with a copy button.
- `CtaBand` is the call-to-action band with a title, a button and a meta line.
- `Delta` shows a signed change. Only a fall is red.
- `Display` is the one big number on a main screen, with optional glow.
- `Heading` is a section or page heading in five sizes. Only the largest glows.
- `Label` is a one-line upper-case label that ends in an ellipsis.
- `PageFooter` is the page's bottom line, such as the version footer.
- `PageHeader` is a page title with an optional meta line.
- `RankRow` is one leaderboard row. "Me" turns it amber and the leader gets a teal rule and a badge.
- `ScreenFx` is the main-screen shell (vignette, scanlines, border, 18px radius).
- `ShareRow` is one line of a share-of-total list with a bar.
- `Stamp` is the handle and range footer of a block meant to be screenshotted.
- `Stat` is a labeled value with an optional sub line, divider and percent.
- `Text` is body copy in three sizes with an optional measure.

### Blocks (`src/ui/2049/blocks/`)

- `CostAnalysisModal` is the cost breakdown dialog per CLI and model.
- `DailyTable` is the paged per-day usage table.
- `DotHeatmap` is the activity heatmap drawn as dots, keyboard walkable.
- `Features` is the landing feature list.
- `IdentityBar` shows the handle, identicon, activity summary and subscriptions, with the owner's share controls.
- `KeyboardCheatsheet` is the dialog that lists the keyboard shortcuts.
- `LandingHero` is the landing hero with the install command and sign-in.
- `LeaderboardFilters` holds the leaderboard period and metric controls.
- `Linked` renders a safe link when there is a valid href, a plain box otherwise.
- `Models` is the per-CLI or per-model share list.
- `MyRank` shows the user's rank with up to three neighbors on each side.
- `Pager` wraps `Pagination` with a summary line.
- `Projects` is the per-repository usage list.
- `RankList` is the compact leaderboard list.
- `RankRail` is the dashboard's rank panel beside the `Readout`.
- `RankTable` is the full leaderboard table, with the user's row pinned below when it is off the page.
- `Readout` is the dashboard's main screen with the period total.
- `StateScreen` stands in for the main screen in the install, expired, invalid, empty, loading and error states.
- `Tabs` is the single-select strip every block header uses.
- `TopNav` is the top navigation with the page links and the GitHub link.
- `Trend` is the usage trend line with rolling windows.
- `UpgradeBanner` asks the user to upgrade the CLI. It sits in the page flow above `TopNav`.

The `.ts` files beside the blocks (`derive`, `format`, `grouping`, `rank`, `shared`, `types`) hold the data shaping. Blocks format and derive. They never fetch.

### shadcn (`src/ui/shadcn/`)

These follow the shadcn file layout, are built on `@base-ui/react` primitives, and use the 2049 tokens directly. Do not add `@radix-ui/*`.

- `badge.tsx` is a small status tag in two color variants of one size.
- `button.tsx` is the button in `default` (amber), `outline` and `ghost`, at `h-control` or `h-control-lg`. Disabled keeps the variant look at 45% opacity.
- `card.tsx` is the flat panel: card ground, one 1px border, 8px radius, 24px padding.
- `dialog.tsx` is the modal panel (see below).
- `pagination.tsx` is page buttons with Prev and Next, skipping pages with an ellipsis.
- `progress.tsx` is the flat 3px amber meter.
- `select.tsx` is the select control and its open panel.
- `switch.tsx` is the on and off switch with its label inside the focus ring.
- `table.tsx` is the 40px-row table that scrolls sideways inside its wrapper.
- `toggle-group.tsx` is the toggle group. Without `multiple` it acts as a tab strip.

### Dialog

The boards have no dialog. `dialog.tsx` is a card-like panel (card ground, border, `rounded-md`) over a dimmed background. Base UI owns the focus trap, Esc, outside click and focus restore. `CostAnalysisModal` and `KeyboardCheatsheet` are its two users. A new modal should reuse it.

## 8. Guardrails

- `scripts/check-design-ssot.mjs` runs as `npm run guardrail:design` and before `npm test` in `dashboard/`. In `src/ui/2049/`, `src/ui/shadcn/` and `src/ui/gallery/` it fails on a literal color, a spacing step off the scale, a `text-[Npx]` size (`src/ui/shadcn/` is exempt from this one for now) and any `leading-*` utility. Files outside those folders, `src/pages/` included, get the v1 checks instead (section 10). The spacing scale is not checked there.
- `scripts/ops/validate-ui-hardcode.cjs` runs as `npm run validate:ui-hardcode` from the repo root. It counts hex and rgb literals and raw JSX text per file under `dashboard/src` and fails when a file not in `scripts/ops/ui-hardcode-baseline.json` has any, when a count rises, or when a new raw text string appears.
- All user-facing text comes from `src/content/copy.csv` through `copy()`. Run `npm run validate:copy` after changing it. See `docs/copy-registry.md`.

## 9. Adding a token

Add it to `src/styles/2049.css` and to this file, then use the utility it generates. Do not hard-code a new value in a component.

## 10. Leftover v1

`src/styles.css` keeps a small v1 theme for the pages that 2049 has not replaced: `AgentResourcePage` (`/developers` and the docs routes), `ErrorBoundary`, and `SignInRedirect` and `SignUpRedirect`. It holds:

- Colors `--color-ink`, `--color-ink-bright`, `--color-ink-text`, `--color-ink-muted`, `--color-ink-line` and `--color-surface`.
- `--font-mono` (Geist Mono), which is also the body font.
- `--tracking-caps`.
- Type utilities `text-display-2`, `text-display-3`, `text-heading`, `text-body`, `text-caption` and `text-micro`.
- Backdrop utilities `fx-grid` and `fx-scanline`.

Do not use these in new work. `check-design-ssot.mjs` applies its v1 checks to every file outside `src/ui/2049/`, `src/ui/shadcn/` and `src/ui/gallery/`. They reject `matrix-*` classes, `[#hex]` colors, `text-[Npx]` and `tracking-[Xem]` brackets, `shadow-[...]` brackets, Tailwind's default `text-xs` to `text-9xl`, `text-white` and its kin, and a `/N` alpha on the rgba `ink-*` colors. When the last of these pages moves to 2049, delete the v1 theme and rename `--font-command` to `--font-mono`.

## 11. Keyboard

`src/hooks/use-global-keybinds.ts` binds single keys on the dashboard. `?` toggles the cheatsheet. `d`, `w`, `m` and `t` switch the period. `r` refreshes, `s` starts the share screenshot, and `esc` closes an overlay. Bindings use no modifier keys and are suppressed while a text field has focus. A new binding needs a row in `KEY_ROWS` in `KeyboardCheatsheet.tsx` too. Nothing checks that the two match.
