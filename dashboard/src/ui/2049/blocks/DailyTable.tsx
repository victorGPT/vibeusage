import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#src/ui/shadcn/table.tsx";

import { full, tokens } from "./format";
import { Pager } from "./Pager";
import { Tabs } from "./Tabs";
import type { DailyRow, DateKey } from "./types";

type Sort = "date" | "tokens";

type DailyTableProps = { rows: DailyRow[]; pageSize?: number; dateKey?: DateKey; paged?: boolean };

function summary(dateKey: DateKey, params: { from: number; to: number; total: number }) {
  return {
    day: copy("ui2049.daily_table.days", params),
    hour: copy("ui2049.daily_table.hours", params),
    month: copy("ui2049.daily_table.months", params),
  }[dateKey];
}

// SSOT: design/2049/source/DailyTable.dc.html.
export function DailyTable({ rows, pageSize = 10, dateKey = "day", paged = true }: DailyTableProps) {
  const [sort, setSort] = useState<Sort>("date");
  const [page, setPage] = useState(1);
  const title = copy("ui2049.daily_table.title");

  const sorted = rows
    .filter((r) => !r.future)
    .sort((a, b) =>
      sort === "tokens" ? tokens(b) - tokens(a) : String(b[dateKey] ?? "").localeCompare(String(a[dateKey] ?? "")),
    );
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = paged ? (current - 1) * pageSize : 0;
  const shown = paged ? sorted.slice(start, start + pageSize) : sorted;
  const label = summary(dateKey, {
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
    total: sorted.length,
  });
  const unsynced = copy("shared.status.unsynced");

  return (
    <Card role="region" aria-label={title} className="gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Label text={title} />
        <div className="ml-auto">
          <Tabs
            label={copy("ui2049.daily_table.sort_aria")}
            value={sort}
            items={[
              { value: "date", label: copy("daily.sort.date.label") },
              { value: "tokens", label: copy("ui2049.my_rank.tokens") },
            ]}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        </div>
      </div>
      <Table className="min-w-160">
        <TableHeader>
          <TableRow>
            <TableHead>{copy("daily.sort.date.label")}</TableHead>
            <TableHead className={cn("text-right", sort === "tokens" && "text-primary")}>
              {copy("daily.sort.total.label")}
            </TableHead>
            <TableHead className="text-right">{copy("daily.sort.input.label")}</TableHead>
            <TableHead className="text-right">{copy("daily.sort.output.label")}</TableHead>
            <TableHead className="text-right">{copy("ui2049.readout.cached")}</TableHead>
            <TableHead className="text-right">{copy("daily.sort.reasoning.label")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => {
            const cell = (value: unknown) => {
              return row.missing ? unsynced : full(value);
            };
            return (
              <TableRow key={String(row[dateKey])}>
                <TableCell>{row[dateKey]}</TableCell>
                <TableCell className="text-right text-hero">{cell(tokens(row))}</TableCell>
                <TableCell className="text-right">{cell(row.input_tokens)}</TableCell>
                <TableCell className="text-right">{cell(row.output_tokens)}</TableCell>
                <TableCell className="text-right">{cell(row.cached_input_tokens)}</TableCell>
                <TableCell className="text-right">{cell(row.reasoning_output_tokens)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {paged ? <Pager summary={label} page={current} pageCount={pageCount} onPageChange={setPage} /> : null}
    </Card>
  );
}
