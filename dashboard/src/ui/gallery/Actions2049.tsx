import { useId, useState } from "react";
import type { ReactNode } from "react";

import { copy } from "../../lib/copy";
import { Badge } from "../shadcn/badge";
import { Button } from "../shadcn/button";
import { Card } from "../shadcn/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  paginationRange,
} from "../shadcn/pagination";
import { Progress } from "../shadcn/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn/select";
import { Switch } from "../shadcn/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../shadcn/table";
import { ToggleGroup, ToggleGroupItem } from "../shadcn/toggle-group";

// The "Spec · Actions" board (design/2049/spec-actions.png) rebuilt from the real components.
// A pinned hover, active or focus cell sets data-force, which the is-* variants in 2049.css
// treat like the real pseudo-class, so each cell renders the classes a user would see.

type Force = "hover" | "focus" | "active";
type State = "normal" | Force | "disabled";

const VARIANTS = ["default", "outline", "ghost"] as const;
const SIZES = ["default", "lg"] as const;
const STATES: State[] = ["normal", "hover", "focus", "active", "disabled"];

const LABEL = "font-sans text-label/none font-semibold uppercase tracking-label text-muted-foreground";
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-6";
const WIDE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,480px),1fr))] gap-x-4 gap-y-6";

const forceProps = (state: State) =>
  state === "normal" || state === "disabled" ? {} : { "data-force": state };

const cellLabel = (...parts: (string | number)[]) => parts.join(" · ");

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" data-block={title}>
      <h2 className="font-display text-heading-s/[1.1] font-light text-hero">{title}</h2>
      {children}
    </section>
  );
}

const PAIR = ["leaderboard.metric.gpt", "leaderboard.metric.claude"] as const;
const MONTHS = ["trend.monitor.month.jan", "trend.monitor.month.feb", "trend.monitor.month.mar", "trend.monitor.month.apr"] as const;
const TOGGLES: { items: readonly string[]; initial: string; label: string; force?: Force }[] = [
  { items: PAIR, initial: PAIR[0], label: "first" },
  { items: PAIR, initial: PAIR[1], label: "last" },
  { items: MONTHS, initial: MONTHS[0], label: "first" },
  { items: MONTHS, initial: MONTHS[3], label: "last" },
  { items: MONTHS, initial: MONTHS[1], label: "focus", force: "focus" },
];

function Toggles({ items, initial, force }: { items: readonly string[]; initial: string; force?: Force }) {
  const [value, setValue] = useState([initial]);
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup aria-label={copy(items[0])} value={value} onValueChange={setValue}>
        {items.map((key) => (
          <ToggleGroupItem key={key} value={key} {...(force && key === initial ? { "data-force": force } : {})}>
            {copy(key)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <output className="text-label-lg text-muted-foreground" data-readout="toggle">
        {value.map((key) => copy(key)).join(",")}
      </output>
    </div>
  );
}

const SWITCHES = [
  { label: "on", checked: true },
  { label: "off", checked: false },
  { label: "disabled · on", checked: true, disabled: true },
  { label: "disabled · off", checked: false, disabled: true },
  { label: "focus", checked: true, force: "focus" },
] as const;

function LiveSwitch({ checked, disabled, force }: { checked: boolean; disabled?: boolean; force?: Force }) {
  const [on, setOn] = useState(checked);
  return (
    <div className="flex flex-col gap-2">
      <Switch checked={on} onCheckedChange={setOn} disabled={disabled} {...(force ? { "data-force": force } : {})}>
        {copy("leaderboard.public_profile.label")}
      </Switch>
      <output className="text-label-lg text-muted-foreground" data-readout="switch">
        {String(on)}
      </output>
    </div>
  );
}

const LIMITS = ["3", "6", "10"].map((n) => ({ value: n, label: copy(`dashboard.projects.limit_top_${n}`) }));

function LimitSelect({ initial }: { initial: string }) {
  const labelId = useId();
  const [value, setValue] = useState(initial as string | null);
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className={LABEL}>
        {copy("dashboard.projects.limit_label")}
      </span>
      <Select items={LIMITS} value={value} onValueChange={setValue}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LIMITS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const PAGES = [
  { total: 3, page: 1, label: "first" },
  { total: 38, page: 1, label: "first" },
  { total: 3, page: 2, label: "middle" },
  { total: 38, page: 19, label: "middle" },
  { total: 3, page: 3, label: "last" },
  { total: 38, page: 38, label: "last" },
];

function Pager({ initial, total }: { initial: number; total: number }) {
  const [page, setPage] = useState(initial);
  const summary = copy("details.pagination.page", { page, total });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={LABEL}>{summary}</span>
      <div className="ml-auto max-w-full min-w-0">
        <Pagination aria-label={summary}>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink disabled={page === 1} onClick={() => setPage(page - 1)}>
                {copy("leaderboard.pagination.prev")}
              </PaginationLink>
            </PaginationItem>
            {paginationRange(page, total).map((item, i) => (
              <PaginationItem key={`${item}-${i}`}>
                {item === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink isActive={item === page} onClick={() => setPage(item)}>
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationLink disabled={page === total} onClick={() => setPage(page + 1)}>
                {copy("leaderboard.pagination.next")}
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

const nf = new Intl.NumberFormat("en-US");
const COLUMNS = ["date", "total", "input", "output"] as const;
const ROWS = [
  ["2026-11-12", 26_100_392, 5_742_086, 1_827_027],
  ["2026-11-11", 27_200_784, 5_984_172, 1_904_055],
  ["2026-11-10", 19_480_311, 4_210_904, 1_377_412],
] as const;
const METERS = [58, 23.4, 100];

export function Actions() {
  return (
    <div className="flex flex-col gap-12">
      <Block title="Button">
        <div className={GRID}>
          {VARIANTS.flatMap((variant) =>
            SIZES.flatMap((size) =>
              STATES.map((state) => (
                <Cell key={`${variant}-${size}-${state}`} label={cellLabel(variant, size, state)}>
                  <Button variant={variant} size={size} disabled={state === "disabled"} {...forceProps(state)}>
                    {copy(variant === "default" ? "landing.nav.login" : "landing.install.action.copy")}
                  </Button>
                </Cell>
              )),
            ),
          )}
          {VARIANTS.map((variant) => (
            <Cell key={`${variant}-href`} label={cellLabel(variant, "href")}>
              <Button variant={variant} nativeButton={false} render={<a href="#__2049" />}>
                {copy("landing.footer.link.docs")}
              </Button>
            </Cell>
          ))}
        </div>
      </Block>

      <Block title="ToggleGroup">
        <div className={GRID}>
          {TOGGLES.map((t) => (
            <Cell key={`${t.items.length}-${t.label}`} label={cellLabel(`${t.items.length} items`, t.label)}>
              <Toggles items={t.items} initial={t.initial} force={t.force} />
            </Cell>
          ))}
        </div>
      </Block>

      <Block title="Switch">
        <div className={GRID}>
          {SWITCHES.map((s) => (
            <Cell key={s.label} label={s.label}>
              <LiveSwitch
                checked={s.checked}
                disabled={"disabled" in s ? s.disabled : undefined}
                force={"force" in s ? s.force : undefined}
              />
            </Cell>
          ))}
        </div>
      </Block>

      <Block title="Select">
        <div className={GRID}>
          <Cell label={cellLabel("default", LIMITS[0].label)}>
            <LimitSelect initial="3" />
          </Cell>
          <Cell label={cellLabel("selected", LIMITS[2].label)}>
            <LimitSelect initial="10" />
          </Cell>
        </div>
      </Block>

      <Block title="Pagination">
        <div className={WIDE_GRID}>
          {PAGES.map((p) => (
            <Cell key={`${p.total}-${p.label}`} label={cellLabel(`${p.total} pages`, p.label)}>
              <Pager initial={p.page} total={p.total} />
            </Cell>
          ))}
        </div>
      </Block>

      <Block title="Badge">
        <div className="flex flex-wrap gap-4">
          <Badge>{copy("leaderboard.metric.gpt")}</Badge>
          <Badge variant="accent">{copy("leaderboard.metric.claude")}</Badge>
        </div>
      </Block>

      <Block title="Table">
        <Card>
          <Table label={"Table"} className="min-w-160">
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c, i) => (
                  <TableHead key={c} className={i > 0 ? `text-right${c === "total" ? " text-primary" : ""}` : undefined}>
                    {copy(`daily.sort.${c}.label`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(([date, ...nums]) => (
                <TableRow key={date}>
                  <TableCell>{date}</TableCell>
                  {nums.map((n, i) => (
                    <TableCell key={i} className={i === 0 ? "text-right text-hero" : "text-right"}>
                      {nf.format(n)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Block>

      <Block title="Progress">
        <div className="flex max-w-[280px] flex-col gap-4">
          {METERS.map((v) => (
            <Progress key={v} value={v} aria-label={`${v}%`} />
          ))}
        </div>
      </Block>
    </div>
  );
}
