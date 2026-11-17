import { Terminal, Upload } from "@carbon/icons-react";
import type { ReactNode } from "react";

import { copy } from "../../lib/copy";
import { Button } from "../hardware/button";
import { SlideSwitch } from "../hardware/slide-switch";
import { InstallKey, ShareKey } from "../vu1/Keys";
import { ModelList } from "../vu1/ModelList";
import { Segment } from "../vu1/SourceSegment";
import { periodOptions, pointLabel, sourceLabel } from "../vu1/labels";
import type { DailyRow, ModelBreakdown, UsagePeriod } from "../vu1/types";
import { UsageScreen } from "../vu1/UsageScreen";

// Each rule in DESIGN.md "Component semantics" shown twice with real components: the use the rule
// asks for and the one it forbids. The rule text lives in DESIGN.md; this page only shows it.

// pair is the Do, then the Don't.
type Rule = { id: string; title: string; component: string; pair: [ReactNode, ReactNode] };

const none = () => {};
const SOURCES = ["all", "claude", "codex", "gemini", "other"].map((id) => ({ value: id, label: sourceLabel(id) }));
const DAY = 86_400_000;
const END = Date.UTC(2026, 10, 16);
const WEEK: DailyRow[] = [0, 0, 0, 0, 0, 62e6, 100e6].map((total_tokens, i) => ({
  day: new Date(END - (6 - i) * DAY).toISOString().slice(0, 10),
  total_tokens,
}));
const ACTIVE = WEEK.filter((row) => Number(row.total_tokens) > 0);
const TOTALS = { total_tokens: 162e6, total_cost_usd: 16.7 };
const RANGE = `${pointLabel(WEEK[0], "day")} – ${pointLabel(WEEK[6], "day")}`;
const NO_HEATMAP = { from: WEEK[0].day as string, to: WEEK[6].day as string, weeks: [] };
const BREAKDOWN: ModelBreakdown = {
  sources: [
    {
      source: "claude",
      totals: { total_tokens: 9.5e6 },
      models: [
        { model_id: "claude-opus-4-7", display_model: "Claude Opus 4.7", totals: { total_tokens: 7.6e6, total_cost_usd: 13.36 } },
        { model_id: "claude-sonnet-4-6", display_model: "Claude Sonnet 4.6", totals: { total_tokens: 0.6e6, total_cost_usd: 1 } },
      ],
    },
    { source: "codex", totals: { total_tokens: 1.3e6 }, models: [{ model_id: "gpt-5.2-codex", display_model: "GPT-5.2 Codex", totals: { total_tokens: 1.3e6, total_cost_usd: 2.34 } }] },
  ],
};

const week = (rows: DailyRow[]) => <UsageScreen range={RANGE} totals={TOTALS} rank={38} rows={rows} heatmap={NO_HEATMAP} />;
const periods = (print?: "key") => (
  <Segment label={copy("vu1.period.label")} options={periodOptions()} value={"week" as UsagePeriod} onChange={none} print={print} />
);

export const RULES: Rule[] = [
  {
    id: "segmented",
    title: copy("vu1.gallery.rule.segmented"),
    component: "src/ui/vu1/SourceSegment.tsx",
    pair: [<Segment label={copy("vu1.source.label")} options={SOURCES} value="all" onChange={none} print="key" />, <Segment label={copy("vu1.source.label")} options={SOURCES} value="all" onChange={none} />],
  },
  {
    id: "slide-switch",
    title: copy("vu1.gallery.rule.slide_switch"),
    component: "src/ui/hardware/slide-switch.tsx",
    pair: [periods("key"), <SlideSwitch label={copy("vu1.period.label")} options={periodOptions().map((option) => option.label)} value={copy("vu1.period.week")} orientation="vertical" />],
  },
  {
    id: "keys",
    title: copy("vu1.gallery.rule.keys"),
    component: "src/ui/vu1/Keys.tsx",
    pair: [(
      <div className="flex gap-s5">
        <ShareKey onPress={none} />
        <InstallKey onPress={none} />
      </div>
    ), (
      <div className="flex gap-s5">
        <Button tone="primary" round aria-label={copy("vu1.keys.share_aria")}>
          <Upload size={20} />
        </Button>
        <Button tone="primary" round aria-label={copy("vu1.keys.install_aria")}>
          <Terminal size={20} />
        </Button>
      </div>
    )],
  },
  {
    id: "bar-chart",
    title: copy("vu1.gallery.rule.usage_screen"),
    component: "src/ui/vu1/UsageScreen.tsx",
    pair: [week(WEEK), week(ACTIVE)],
  },
  {
    id: "table",
    title: copy("vu1.gallery.rule.table"),
    component: "src/ui/vu1/ModelList.tsx",
    pair: [<ModelList breakdown={BREAKDOWN} frame="single" />, <ModelList breakdown={BREAKDOWN} />],
  },
];

const VERDICTS = [
  ["do", copy("vu1.gallery.do")],
  ["dont", copy("vu1.gallery.dont")],
] as const;

export function DoDontVu1() {
  return (
    <>
      {RULES.map((rule) => (
        <section key={rule.id} data-kit="module" data-rule={rule.id} aria-label={rule.title} className="col-span-12">
          <h2 data-kit="caption">{rule.title}</h2>
          <div className="grid grid-cols-1 gap-s5 min-[761px]:grid-cols-2">
            {VERDICTS.map(([verdict, caption], i) => (
              <figure key={verdict} data-verdict={verdict} data-kit="stage" className="m-0 flex flex-col gap-s2">
                <div data-kit="surface">{rule.pair[i]}</div>
                <figcaption data-kit="caption">{caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
