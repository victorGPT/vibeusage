---
name: vibeusage-design
description: Use this skill to generate well-branded interfaces and assets for VibeUsage, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Brand**: VibeUsage — Bloomberg terminal × The Matrix. Three words: `hacker · 复古 · cyberpunk`.
- **Pocket color**: Matrix Green `#00FF41` on `#050505`. Single gold accent `#FFD700` reserved for leaderboard #1 / cost.
- **Font**: Geist Mono only (system fallback to ui-monospace). No exceptions.
- **Signature**: single 1px hairline panel + corner-cross title chip on the top rule + scanline overlay. (v3 dropped the earlier box-drawing-glyph frames; see `chats/chat2.md`.)
- **Drop-in tokens**: `colors_and_type.css` — covers all colors, type, spacing, shadows, animations.
- **Hard rules**: zero radius on every data surface (only the status dot, avatars, and floating action buttons round — see README §Corner radii), 1px solid borders only, no emoji, uppercase labels, tabular numerals.
- **Reference recreation**: `ui_kits/dashboard/` — open `index.html` to see the product.

## Hard "do not" list

- Don't add emoji.
- Don't use `text-[Npx]`, `[#hex]`, `tracking-[Xem]`, `shadow-[…]`, `opacity-30..90`, `rounded-*`, `bg-white`, `text-white`.
- Don't introduce a third hue for prose / surfaces / accents. Palette ceiling is **two ink stops + one gold + neutral surfaces + the warn/err status escape hatch** (warn `#FFB300` / err `#FF3344`, status indicators only).
- Don't use bouncy / spring easing. Linear / ease only, 200ms.
- Don't use SaaS rounded cards, gradient headers, or icon-tile grids.
- Don't soften numbers ("~1M"). Show `1,042,318`.
