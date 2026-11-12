import { useId } from "react";

import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Stat } from "#src/ui/2049/base/Stat.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#src/ui/shadcn/select.tsx";

import { abbr, num, pct, tokens } from "./format";
import { Linked } from "./Linked";
import type { ProjectEntry } from "./types";

type ProjectsProps = {
  entries: ProjectEntry[];
  totalTokens?: number | string;
  limit: number;
  onLimitChange?: (limit: number) => void;
};

function limits() {
  return [
    { value: "3", label: copy("dashboard.projects.limit_top_3") },
    { value: "6", label: copy("dashboard.projects.limit_top_6") },
    { value: "10", label: copy("dashboard.projects.limit_top_10") },
  ];
}

// SSOT: design/2049/source/Projects.dc.html. project_key is "org/repo".
export function Projects({ entries, totalTokens, limit, onLimitChange }: ProjectsProps) {
  const labelId = useId();
  const title = copy("ui2049.projects.title");
  const shown = entries.slice(0, limit);
  const max = Math.max(1, ...shown.map(tokens));
  const total = num(totalTokens);
  const items = limits();
  return (
    <Card role="region" aria-label={title}>
      <div className="flex items-center gap-3">
        <Label text={title} />
        {onLimitChange ? (
          <div className="ml-auto flex items-center gap-2">
            <span id={labelId} className="font-sans text-label/none font-semibold tracking-label text-muted-foreground uppercase">
              {copy("dashboard.projects.limit_label")}
            </span>
            <Select items={items} value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
              <SelectTrigger aria-labelledby={labelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-y-6 border-t border-border pt-4 sm:grid-cols-3 sm:gap-x-4">
        {shown.map((entry) => {
          const slash = entry.project_key.indexOf("/");
          const org = slash === -1 ? "" : entry.project_key.slice(0, slash);
          const repo = entry.project_key.slice(slash + 1);
          const value = tokens(entry);
          return (
            <div
              key={entry.project_key}
              className="flex min-w-0 flex-col gap-2 sm:not-nth-[3n+1]:border-l sm:not-nth-[3n+1]:border-border sm:not-nth-[3n+1]:pl-4"
            >
              {org ? <Label text={org} /> : null}
              <Linked href={entry.project_ref} className="hover:underline">
                <Text text={repo} tone="light" weight={600} />
              </Linked>
              <Stat
                value={abbr(value)}
                sub={total ? pct((value / total) * 100) : undefined}
                pct={(value / max) * 100}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
