import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { copy } from "../../lib/copy";
import { BarGraph } from "../hardware/bar-graph";
import { Button } from "../hardware/button";
import { ButtonGroup } from "../hardware/button-group";
import { CodeBlock } from "../hardware/code-block";
import { Device } from "../hardware/device";
import { Display } from "../hardware/display";
import { Icon } from "../hardware/icon";
import type { IconName } from "../hardware/icon";
import { ItemList } from "../hardware/item-list";
import { Lcd, LcdDigits } from "../hardware/lcd";
import { Pagination } from "../hardware/pagination";
import { Segmented } from "../hardware/segmented-control";
import { Skeleton } from "../hardware/skeleton";
import { SlideSwitch } from "../hardware/slide-switch";
import { Tabs } from "../hardware/tabs";
import { notify } from "../hardware/toaster";
import { BlocksVu1 } from "./BlocksVu1";

// Dev-only SPEC-01 gallery mounted at /__vu1 (see main.jsx). Captions are component names or
// values read back from the rendered element; specimen text comes from copy keys.

// Class names stay literal: Tailwind only generates utilities it finds spelled out in source.
const SCALE = [
  ["s1", "w-s1"],
  ["s2", "w-s2"],
  ["s3", "w-s3"],
  ["s4", "w-s4"],
  ["s5", "w-s5"],
  ["s6", "w-s6"],
  ["s7", "w-s7"],
  ["s8", "w-s8"],
] as const;

const COLUMNS = Array.from({ length: 12 }, (_, i) => i + 1);

const STATES = [
  ["hover", ":hover"],
  ["active", ":active"],
  ["focus", ":focus-visible"],
] as const;
type State = (typeof STATES)[number][0];
const DEFAULT_STATE = "default";

// Copies every skin rule written for :hover, :active or :focus-visible with the pseudo-class
// swapped for [data-force="…"], so each state can sit still beside the default for a screenshot.
// Focus rings are gated on keyboard modality; the copies drop that gate.
let rulesForced = false;
function forceStateRules() {
  if (rulesForced) return;
  rulesForced = true;
  const visit = (parent: CSSStyleSheet | CSSGroupingRule | CSSStyleRule) => {
    const list = parent.cssRules;
    for (let i = list.length - 1; i >= 0; i--) {
      const rule = list[i];
      if (rule instanceof CSSGroupingRule || rule instanceof CSSStyleRule)
        visit(rule);
      if (!(rule instanceof CSSStyleRule)) continue;
      const selector = rule.selectorText;
      if (
        !/:(?:hover|active|focus-visible)/.test(selector) ||
        selector.includes('data-modality="pointer"')
      )
        continue;
      let forced: string = selector.replace(
        /(?::root)?\[data-modality="keyboard"\]\s*/g,
        "",
      );
      for (const [state, pseudo] of STATES)
        forced = forced.replaceAll(pseudo, `[data-force="${state}"]`);
      parent.insertRule(`${forced} { ${rule.style.cssText} }`, i + 1);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet);
    } catch {
      // Cross-origin sheets can't be read; none of them belong to the skin.
    }
  }
}

const CONTROL =
  'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])';

// The state lands where a pointer or keyboard would put it: on the copy's first control, and for
// hover and press on every ancestor the pointer would also be over.
function Forced({ state, children }: { state: State; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const control = ref.current!.querySelector(CONTROL);
    for (
      let el = control;
      el && el !== ref.current;
      el = state === "focus" ? null : el.parentElement
    ) {
      el.setAttribute("data-force", state);
      if (state === "active") el.setAttribute("data-pressed", "");
    }
  });
  return (
    <figure ref={ref} className="flex flex-col items-center gap-s2">
      {children}
      <figcaption data-kit="caption">{state}</figcaption>
    </figure>
  );
}

function Panel({
  name,
  span,
  states,
  children,
}: {
  name: string;
  span: string;
  states?: boolean;
  children: ReactNode;
}) {
  return (
    <section data-kit="module" aria-label={name} className={span}>
      <h2 data-kit="caption">{name}</h2>
      <div data-kit="stage">
        <div data-kit="surface">
          {states ? (
            <div className="grid w-full grid-cols-1 gap-s5 sm:grid-cols-2 xl:grid-cols-4">
              <figure className="flex flex-col items-center gap-s2">
                {children}
                <figcaption data-kit="caption">{DEFAULT_STATE}</figcaption>
              </figure>
              {STATES.map(([state]) => (
                <Forced key={state} state={state}>
                  {children}
                </Forced>
              ))}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}

function Readback({ read }: { read: (el: HTMLElement) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState("");
  useLayoutEffect(
    function measure() {
      setText(read(ref.current!.parentElement!));
    },
    [read],
  );
  return (
    <span ref={ref} data-kit="value">
      {text}
    </span>
  );
}

const width = (el: HTMLElement) =>
  `${el.querySelector<HTMLElement>("[data-bar]")!.offsetWidth}px`;
const gap = (el: HTMLElement) =>
  `${getComputedStyle(el.querySelector("[data-grid]")!).columnGap}`;

// SPEC-01's default key, orange-red (src/LabPanel.tsx in shuding/spec-01).

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const ROWS = [
  { rank: 1, tokens: 1_284_000_000 },
  { rank: 2, tokens: 963_400_000 },
  { rank: 3, tokens: 512_900_000 },
  { rank: 4, tokens: 207_300_000 },
];
const LEVELS = [
  0.32, 0.4, 0.62, 0.78, 0.84, 0.71, 0.66, 0.74, 0.58, 0.44, 0.5, 0.61,
];
const ICONS: IconName[] = [
  "prev",
  "next",
  "plus",
  "minus",
  "chart",
  "dashboard",
  "group",
  "currency",
  "check",
  "close",
];
const PERIODS = [
  copy("leaderboard.period.week"),
  copy("leaderboard.period.month"),
  copy("leaderboard.period.total"),
];

function Rocker() {
  const none = () => {};
  return (
    <ButtonGroup
      label={copy("leaderboard.column.rank")}
      tone="primary"
      parts={[
        {
          label: copy("leaderboard.pagination.prev"),
          content: <Icon name="prev" />,
          onPress: none,
        },
        {
          label: copy("leaderboard.pagination.next"),
          content: <Icon name="next" />,
          onPress: none,
        },
      ]}
    />
  );
}

export function GalleryVu1() {
  useEffect(forceStateRules, []);
  return (
    <div data-vu1-gallery className="px-s4 py-s7">
      <main className="grid-page mx-auto max-w-shell gap-y-s5">
        <BlocksVu1 />
        <Panel name="spacing --spacing-s1..s8" span="col-span-12">
          <div className="flex w-full flex-wrap items-end justify-between gap-s5">
            {SCALE.map(([name, cls]) => (
              <div key={name} className="flex flex-col items-start gap-s2">
                <span data-bar className={`${cls} h-s8 bg-current`} />
                <span data-kit="label">{name}</span>
                <Readback read={width} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel name="grid-page 12 columns" span="col-span-12">
          <div className="flex w-full flex-col gap-s2">
            <div data-grid className="grid-page">
              {COLUMNS.map((n) => (
                <span
                  key={n}
                  className="flex h-s8 items-end justify-center bg-current/15 pb-s1"
                >
                  <span data-kit="label">{n}</span>
                </span>
              ))}
            </div>
            <Readback read={gap} />
          </div>
        </Panel>
        <Panel name="device / grid-device" span="col-span-12">
          <div className="w-full [--device-w:100%]">
            <Device
              model={copy("vu1.device.model")}
              name={copy("vu1.device.name")}
            >
              <div className="flex flex-col gap-s2">
                <div data-grid className="grid-device">
                  {COLUMNS.map((n) => (
                    <span
                      key={n}
                      className="flex h-s7 items-end justify-center bg-current/15 pb-s1"
                    >
                      <span data-kit="label">{n}</span>
                    </span>
                  ))}
                </div>
                <Readback read={gap} />
              </div>
            </Device>
          </div>
        </Panel>
        <Panel name="button" span="col-span-12" states>
          <div className="flex items-center gap-s3">
            <Button tone="primary">{copy("dashboard.install.title")}</Button>
            <Button>{copy("dashboard.sign_out")}</Button>
          </div>
        </Panel>
        <Panel name="button-group" span="col-span-12 lg:col-span-6" states>
          <Rocker />
        </Panel>
        <Panel name="segmented-control" span="col-span-12 lg:col-span-6" states>
          <Segmented
            label={copy("leaderboard.column.total")}
            options={PERIODS}
            defaultValue={PERIODS[0]}
          />
        </Panel>
        <Panel name="slide-switch" span="col-span-12 lg:col-span-6" states>
          <SlideSwitch
            label={copy("leaderboard.column.total")}
            options={PERIODS}
            defaultValue={PERIODS[1]}
          />
        </Panel>
        <Panel name="toaster" span="col-span-12 lg:col-span-6" states>
          <Button
            onClick={() =>
              notify(copy("landing.install.action.copied"), {
                description: copy("landing.install.command"),
              })
            }
          >
            {copy("landing.install.action.copy")}
          </Button>
        </Panel>
        <Panel name="pagination" span="col-span-12" states>
          <Pagination pageCount={12} />
        </Panel>
        <Panel name="tabs" span="col-span-12" states>
          <Tabs
            label={copy("leaderboard.column.total")}
            items={PERIODS.map((label, i) => ({
              value: label,
              label,
              body: <LcdDigits value={compact.format(ROWS[i].tokens)} />,
            }))}
          />
        </Panel>
        <Panel name="item-list" span="col-span-12 lg:col-span-6">
          <ItemListDemo />
        </Panel>
        <Panel name="code-block" span="col-span-12 lg:col-span-6">
          <CodeBlock language="sh" code={copy("landing.install.command")} />
        </Panel>
        <Panel name="display" span="col-span-12 lg:col-span-6">
          <Display label={copy("leaderboard.column.total")} aspect="21 / 9">
            <BarGraph
              label={copy("leaderboard.column.total")}
              values={LEVELS}
              segments={16}
            />
          </Display>
        </Panel>
        <Panel name="bar-graph" span="col-span-12 lg:col-span-6">
          <div data-bar-graph-demo>
            <BarGraph
              label={copy("leaderboard.column.total")}
              values={LEVELS}
              segments={16}
            />
          </div>
        </Panel>
        <Panel name="lcd" span="col-span-12 lg:col-span-6">
          <div className="flex flex-wrap items-center gap-s4">
            <Lcd tag={copy("leaderboard.column.rank")} size="sm">
              <LcdDigits value={number.format(ROWS[2].rank)} />
            </Lcd>
            <Lcd tag={copy("leaderboard.column.total")}>
              <LcdDigits value={compact.format(ROWS[0].tokens)} />
            </Lcd>
            <Lcd tag={copy("leaderboard.period.week")} size="lg">
              <LcdDigits value={number.format(ROWS[3].rank * 1024)} />
            </Lcd>
          </div>
        </Panel>
        <Panel name="icon" span="col-span-12 lg:col-span-6">
          <div className="flex flex-wrap items-center gap-s4">
            {ICONS.map((name) => (
              <Icon key={name} name={name} size={20} />
            ))}
          </div>
        </Panel>
        <Panel name="skeleton" span="col-span-12 lg:col-span-6">
          <Skeleton lines={3} />
        </Panel>
      </main>
    </div>
  );
}

function ItemListDemo() {
  const [chosen, setChosen] = useState("2");
  return (
    <ItemList
      label={copy("leaderboard.column.rank")}
      rows={ROWS}
      rowKey={(row) => String(row.rank)}
      value={chosen}
      onValueChange={setChosen}
      columns={[
        {
          key: "rank",
          label: copy("leaderboard.column.rank"),
          width: "48px",
          render: (row) => number.format(row.rank),
        },
        {
          key: "user",
          label: copy("leaderboard.column.user"),
          width: "minmax(0, 1fr)",
          render: () => copy("shared.placeholder.anon_mark"),
        },
        {
          key: "total",
          label: copy("leaderboard.column.total"),
          width: "96px",
          align: "end",
          render: (row) => compact.format(row.tokens),
        },
      ]}
    />
  );
}
