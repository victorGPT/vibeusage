import type { ComponentProps, ReactNode } from "react";

import { CommandBox } from "../2049/base/CommandBox";
import { CtaBand } from "../2049/base/CtaBand";
import { Delta } from "../2049/base/Delta";
import { Display } from "../2049/base/Display";
import { Heading } from "../2049/base/Heading";
import { Label, type LabelTone } from "../2049/base/Label";
import { PageFooter } from "../2049/base/PageFooter";
import { PageHeader } from "../2049/base/PageHeader";
import { RankRow } from "../2049/base/RankRow";
import { ScreenFx } from "../2049/base/ScreenFx";
import { ShareRow } from "../2049/base/ShareRow";
import { Stamp } from "../2049/base/Stamp";
import { Stat } from "../2049/base/Stat";
import { Text } from "../2049/base/Text";
import { Badge } from "../shadcn/badge";
import { Progress } from "../shadcn/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../shadcn/table";

// The SpecType, SpecData and SpecLayout boards (design/2049/spec-*.png) rebuilt from the real
// components. Specimen strings are the boards' own fixture data so each cell can be compared
// one to one; this page is dev-only and never ships.

function Board({ id, title, meta, children }: { id: string; title: string; meta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-12" data-spec={id}>
      <PageHeader title={title} meta={meta} />
      {children}
    </div>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Heading text={title} size="s" />
      {children}
    </section>
  );
}

function Cell({ cap, children, plain }: { cap: string; children: ReactNode; plain?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {plain ? <Text text={cap} size="s" tone="muted" /> : <Label text={cap} />}
      {children}
    </div>
  );
}

const WEEK_RANK = "Week rank";
const INSTALL = "Install the tracker";
const SENTENCE = "13.0M tokens a day. Codex took 58.0% of it.";
const LONG_TEXT =
  "Every token your agents burn is counted locally, summed per model and per project, then synced once a day. Nothing leaves your machine except the totals.";
const TOTAL = "4,733,386,712";
const LONG_HANDLE = "an_unreasonably_long_handle_that_keeps_going_forever";

const LABELS: LabelTone[] = ["muted", "accent", "alert", "teal"];

type HeadingSpec = Pick<ComponentProps<typeof Heading>, "size" | "upper" | "tone"> & { cap: string };
const HEADINGS: HeadingSpec[] = [
  ...(["xl", "l", "m", "s", "xs"] as const).flatMap((size) =>
    [false, true].map((upper) => ({ size, upper, cap: `${size} · upper ${upper ? "on" : "off"}` })),
  ),
  { size: "m", tone: "amber", cap: "m · amber" },
  { size: "s", upper: true, tone: "amber", cap: "s · upper · amber" },
];

const TEXTS = (["s", "m", "l"] as const).flatMap((size) =>
  (["body", "muted", "light"] as const).map((tone) => ({ size, tone })),
);

const DISPLAYS = [
  { size: 88, glow: true, tone: "light" },
  { size: 88, glow: false, tone: "light" },
  { size: 76, glow: true, tone: "light" },
  { size: 76, glow: false, tone: "light" },
  { size: 28, glow: true, tone: "light" },
  { size: 28, glow: false, tone: "light" },
  { size: 76, glow: true, tone: "amber" },
] as const;

const BADGES = [
  { cap: "outline", text: "Codex", variant: "outline" },
  { cap: "accent", text: "Leader", variant: "accent" },
  { cap: "outline · long · truncates", text: "claude-opus-4-1-20250805-thinking", variant: "outline" },
  { cap: "accent · long · truncates", text: "Top contributor this week", variant: "accent" },
] as const;

const STATS = [
  { cap: "L", value: "195.9M" },
  { cap: "S", value: "195.9M", size: "S" },
  { cap: "L · divider", value: "195.9M", divider: true },
  { cap: "L · sub", value: "195.9M", sub: "+12% wk" },
  { cap: "L · pct 58", value: "195.9M", pct: 58 },
  { cap: "L · amber", value: "195.9M", tone: "amber" },
  { cap: "L · long value", value: "21,410,592,118" },
  { cap: "S · long value · divider", value: "21,410,592,118", size: "S", divider: true },
  { cap: "L · value 0", value: "0", pct: 0 },
] as const;

const DELTAS = [
  { cap: "+3", value: 3 },
  { cap: "−2", value: -2 },
  { cap: "0", value: 0 },
  { cap: "−2 · suffix", value: -2, suffix: "vs last week" },
] as const;

const SHARES = [
  { cap: "normal", label: "Codex", value: "2.75B", pctText: "58.0%", bar: 100, sub: "gpt-5.2-codex 64%   gpt-5.2 18%" },
  {
    cap: "long name · truncates",
    label: "claude-opus-4-1-20250805-thinking via openrouter-proxy",
    value: "412.0M",
    pctText: "8.7%",
    bar: 15,
  },
] as const;

const RANKS = [
  { cap: "normal", rank: "#4", user: "night_shift_dev", value: "312.4M", delta: 3 },
  { cap: "me", rank: "#7", user: "your_handle · you", value: "195.9M", delta: -2, me: true },
  { cap: "lead", rank: "#1", user: "tokenfurnace", value: "4.73B", delta: 0, lead: true },
  { cap: "lead + me", rank: "#1", user: "your_handle · you", value: "4.73B", delta: 1, me: true, lead: true },
  { cap: "long name · truncates", rank: "#4", user: LONG_HANDLE, value: "312.4M", delta: 3 },
  { cap: "no delta", rank: "#12", user: "new_here", value: "8.1M" },
] as const;

const STAMPS = [
  { cap: "normal", handle: "your_handle", range: "2026-11-06 → 11-12" },
  { cap: "long range · wraps", handle: "an_unreasonably_long_handle", range: "2025-11-13 → 2026-11-12 · all time since launch" },
] as const;

type Row = { rank: string; user: string; delta?: number; value: string };
const ROWS: Row[] = [
  { rank: "#1", user: "tokenfurnace", value: "4.73B" },
  { rank: "#2", user: "night_shift_dev", delta: 3, value: "3.12B" },
  { rank: "#3", user: "ralph_loop", delta: -2, value: "2.80B" },
];
const LONG_ROWS: Row[] = [
  { rank: "#4", user: LONG_HANDLE, delta: 1, value: "1.04B" },
  { rank: "#5", user: "short", value: "980.2M" },
];
const PINNED: Row = { rank: "#7", user: "your_handle · you", delta: -2, value: "195.9M" };

function SpecRow({ row, me = false }: { row: Row; me?: boolean }) {
  return (
    <TableRow className={me ? "bg-primary/8 text-primary" : undefined}>
      <TableCell className="w-16 font-display text-copy-m">{row.rank}</TableCell>
      <TableCell className={me ? "max-w-0 truncate text-primary" : "max-w-0 truncate text-hero"}>
        <span className="inline-flex max-w-full items-center gap-2">
          <span className="truncate">{row.user}</span>
          {row.delta === undefined ? null : <Delta value={row.delta} />}
        </span>
      </TableCell>
      <TableCell className={me ? "text-right font-display text-primary" : "text-right font-display text-hero"}>
        {row.value}
      </TableCell>
    </TableRow>
  );
}

function SpecTable({ rows, pinned, empty }: { rows: Row[]; pinned?: Row; empty?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{"Rank"}</TableHead>
          <TableHead>{"User"}</TableHead>
          <TableHead className="text-right text-primary">{"Tokens"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pinned ? <SpecRow row={pinned} me /> : null}
        {rows.map((r) => (
          <SpecRow key={r.rank} row={r} />
        ))}
        {empty ? (
          <TableRow>
            <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function Spec() {
  return (
    <div className="flex flex-col gap-16">
      <Board id="type" title="Spec · Type" meta="Label, Heading, Text, Display, Badge — every size × tone">
        <Part title="Label">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            {LABELS.map((tone) => (
              <Cell key={tone} cap={`tone · ${tone}`}>
                <Label text={WEEK_RANK} tone={tone} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="Heading">
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
            {HEADINGS.map((h) => (
              <Cell key={h.cap} cap={h.cap}>
                <Heading text={INSTALL} size={h.size} upper={h.upper} tone={h.tone} level={3} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="Text">
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-3">
            {TEXTS.map((t) => (
              <Cell key={`${t.size}${t.tone}`} cap={`${t.size} · ${t.tone}`}>
                <Text text={SENTENCE} size={t.size} tone={t.tone} />
              </Cell>
            ))}
          </div>
          <Cell cap="m · body · maxCh 48 · wraps">
            <Text text={LONG_TEXT} maxCh={48} />
          </Cell>
        </Part>
        <Part title="Display">
          <div className="flex flex-col gap-6">
            {DISPLAYS.map((d) => (
              <Cell
                key={`${d.size}${d.glow}${d.tone}`}
                cap={`${d.size}${d.tone === "amber" ? " · amber" : ""} · glow ${d.glow ? "on" : "off"}`}
              >
                <Display text={TOTAL} size={d.size} tone={d.tone} glow={d.glow} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="Badge">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            {BADGES.map((b) => (
              <Cell key={b.cap} cap={b.cap}>
                <div className="max-w-40 min-w-0">
                  <Badge variant={b.variant}>{b.text}</Badge>
                </div>
              </Cell>
            ))}
          </div>
        </Part>
      </Board>

      <Board id="data" title="Spec · Data" meta="Stat, Meter, Delta, ShareRow, RankRow — edge values included">
        <Part title="Stat">
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-3">
            {STATS.map((s) => (
              <Cell key={s.cap} cap={s.cap} plain>
                <Stat label="Last 7 days" {...s} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="Meter">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            {[0, 3, 50, 100].map((pct) => (
              <Cell key={pct} cap={`pct ${pct}`}>
                <Progress value={pct} aria-label={`${pct}%`} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="Delta">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
            {DELTAS.map((d) => (
              <Cell key={d.cap} cap={d.cap}>
                <div>
                  <Delta value={d.value} suffix={"suffix" in d ? d.suffix : undefined} />
                </div>
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="ShareRow">
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
            {SHARES.map(({ cap, ...s }) => (
              <Cell key={cap} cap={cap}>
                <ShareRow {...s} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="RankRow">
          <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2" data-spec-part="rankrow">
            {RANKS.map(({ cap, ...r }) => (
              <Cell key={cap} cap={cap}>
                <RankRow {...r} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="CommandBox">
          <div className="max-w-130">
            <CommandBox command="npx --yes vibeusage init" />
          </div>
        </Part>
      </Board>

      <Board id="layout" title="Spec · Layout" meta="Stamp, PageHeader, PageFooter, CtaBand, Table, ScreenFx">
        <Part title="Stamp">
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
            {STAMPS.map(({ cap, ...s }) => (
              <Cell key={cap} cap={cap}>
                <Stamp {...s} />
              </Cell>
            ))}
          </div>
        </Part>
        <Part title="PageHeader · PageFooter · CtaBand">
          <Label text="PageHeader" />
          <PageHeader title="Leaderboard" meta="2026-11-06 → 11-12 · updated 4 min ago" />
          <Label text="PageFooter" />
          <PageFooter left="Synced 4 min ago · UTC" right="v0.7.1" />
          <Label text="CtaBand" />
          <CtaBand
            title="See where you rank this week."
            buttonLabel="Sign in with GitHub"
            href="#__2049"
            meta="v0.7.1 · open source"
          />
        </Part>
        <Part title="Table">
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-2">
            <Cell cap="normal">
              <SpecTable rows={ROWS} />
            </Cell>
            <Cell cap="pinned · me">
              <SpecTable rows={ROWS} pinned={PINNED} />
            </Cell>
            <Cell cap="empty">
              <SpecTable rows={[]} empty="No one has synced this week yet." />
            </Cell>
            <Cell cap="long name · truncates">
              <SpecTable rows={LONG_ROWS} />
            </Cell>
          </div>
        </Part>
        <Part title="ScreenFx">
          <Label text="embedded in a main-screen shell" />
          <ScreenFx>
            <div className="flex flex-col gap-3">
              <Label text="Total tokens · all time" />
              <Display text={TOTAL} size={76} />
            </div>
          </ScreenFx>
        </Part>
      </Board>
    </div>
  );
}
