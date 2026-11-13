# Product

## Register

product

## Users

**Primary**: developers active on X / Twitter who already post screenshots of their dev tools, token bills, and yearly recaps. They use multiple AI coding CLIs in parallel (Claude Code, Codex, Gemini, OpenCode, Kimi, Hermes, OpenClaw) and want a single surface that turns their consumption into a brag-worthy artifact.

**Context of use**:
- Daily / weekly: open the dashboard, scan personal numbers, check leaderboard rank.
- Milestone moments: hit a personal record (1M tokens crossed, leaderboard top-N, year-end), screenshot a single panel, post to X with one line of caption.
- Onboarding: hand the install guide to their own coding agent, watch numbers populate within minutes.

**Job to be done**:
1. Settle the AI bill in their head — see total spend, per-CLI split, where the cost actually went.
2. Compare against peers — leaderboard, handle, rank as core narrative, not afterthought.
3. Produce screenshots that look earned, not corporate. The product is the screenshot.

## Product Purpose

VibeUsage turns scattered AI CLI token consumption into one **competitive, screenshot-native artifact**. It is not an enterprise ops dashboard, not a billing console, not a wellness "digital detox" reflection. It is a developer's social currency made of their own data. The numbers come from the terminal, carry an amber stamp, and get posted to X.

**Success looks like**:
- Users screenshot a single Panel and post it without further editing.
- Leaderboard handles get bragged about ("just hit #3 on @vibeusage").
- The dashboard does **not** look like Datadog, Grafana, GitHub Wrapped, or Spotify Wrapped.

## Brand Personality

Three words: **hacker · retro · cyberpunk**.

- **Hacker**: honest with the numbers, no rounding for comfort, no "you're amazing!" copy. Every label is short, upper-case and fits on one line.
- **Retro**: CRT screen material, with scanlines, a vignette and phosphor glow on the big number. Material from old terminals, not 2024 SaaS.
- **Cyberpunk**: one amber accent on a deep teal ground, and density that signals signal. Blade Runner 2049 street-screen tech, not Web3 dapp purple-blur.

**Tone**:
- Captions are technical, sometimes self-deprecating. ("you've spent more on Sonnet than on coffee this month")
- Numbers are loud, prose is quiet.
- No emoji in the UI. No exclamation marks in the copy.
- Empty states read like terminal stderr, not friendly mascot text.

**Emotional goal**: the user feels **seen and slightly called out** — like an old terminal friend that knows exactly how much money they burned today.

## Anti-references

What this should explicitly **not** look like:

- **Datadog / Grafana / New Relic** — corporate ops palette (navy, slate, hospital-blue), 24 widgets vying for attention, hover tooltips explaining every axis. VibeUsage assumes the user is a developer who can read a number.
- **GitHub Wrapped / Spotify Wrapped** — confetti, emoji volcanoes, gradient banners, cartoon illustrations, "you're a top 0.1% listener!" framing. A milestone should feel like a debrief, not a celebration.
- **SaaS marketing template** — hero-metric block (big number, small label, supporting stats, gradient accent, mid-card CTA), glass cards, gradient text, identical "icon + heading + paragraph" tile grids.
- **Web3 dapp neon** — purple-pink-cyan gradients, frosted glass, "futuristic" via blur instead of via density. Cyberpunk via signal, not via Photoshop filters.
- **Friendly fintech** — Apple Wallet pastels, soft shadows, large rounded cards. Numbers should not be cushioned.

## Design Principles

1. **Screenshot is the product**. Every core Panel must be screenshot-worthy on its own. Its composition, density and signature element (the `Stamp` footer, the scanlined main screen) survive cropping. If a panel only works embedded in the page, redesign it.

2. **Numbers as hero, labels as supporting cast**. The `Display` number and the screen and value sizes carry the weight. Captions and headings exist to label numbers, never to compete with them. Hierarchy ratio ≥ 1.25 is non-negotiable.

3. **Hacker honest, not corporate kind**. No tooltips that explain obvious things. No "great job!" affirmations. No reassuring rounding. Errors look like stderr. Empty states look like `// no data yet`. The product respects the user's literacy.

4. **Retro-cyberpunk as material, not decoration**. Scanlines, the screen vignette and phosphor glow are structural. They earn their place by carrying signal (the main number, the current item, the user's own row). They are never "atmosphere added at the end".

5. **Compete, don't comfort**. Leaderboard, handle, rank and the leader mark are core narrative. The product is partly about ranking against peers. Do not soften ranks ("everyone's a winner"), do not hide numbers behind progress bars, do not vague-up cost.

## Accessibility & Inclusion

**Target**: WCAG 2.1 AA on contrast, keyboard navigation, focus visibility.

**Specific accommodations**:
- The 2049 screen material is static. The scanlines do not move or flash.
- `screenshot-capture` mode (already implemented) disables all motion and freezes layout. The share flow uses it.
- Information layering does not depend on color discrimination. The amber "me" row and the teal leader mark each come with a structural mark (position number, badge, top rule).
- The shadcn controls (button, select, switch, toggle group, table) and the TopNav, RankTable, DotHeatmap and Linked links render a 2px amber outline (`outline-ring`) on `:focus-visible`.
- Labels start at 11px and badges at 10px. Smaller sizes are not in the token system (DESIGN.md section 3).
- All UI text routes through `dashboard/src/content/copy.csv`. No string is hard-coded in components.

**Known gap**: no formal screen-reader pass yet for the dashboard chart components. To be addressed in `harden` step of v3.
