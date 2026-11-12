import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "../badge";
import { Button, buttonVariants } from "../button";
import { Card } from "../card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  paginationRange,
} from "../pagination";
import { Progress } from "../progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Switch } from "../switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

describe("Button", () => {
  it("does not fire onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        {"go"}
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{"go"}</Button>);
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("styles each state through the variants the gallery can force", () => {
    for (const variant of ["default", "outline", "ghost"] as const) {
      const cls = buttonVariants({ variant });
      expect(cls).toMatch(/\bis-hover:/);
      expect(cls).toMatch(/\bis-active:/);
      expect(cls).toMatch(/\bis-focus:outline-2\b/);
      expect(cls).not.toMatch(/(^|\s)(hover|active|focus-visible):/);
    }
  });
});

describe("ToggleGroup", () => {
  function Period({ onValueChange }: { onValueChange: (value: string[]) => void }) {
    const [value, setValue] = useState(["day"]);
    return (
      <ToggleGroup
        aria-label="period"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      >
        <ToggleGroupItem value="day">{"day"}</ToggleGroupItem>
        <ToggleGroupItem value="week">{"week"}</ToggleGroupItem>
      </ToggleGroup>
    );
  }

  it("reports the picked item and moves the pressed state to it", async () => {
    const onValueChange = vi.fn();
    render(<Period onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "week" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["week"]);
    expect(screen.getByRole("button", { name: "week" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the selected item when it is pressed again", async () => {
    const onValueChange = vi.fn();
    render(<Period onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "day" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Switch", () => {
  it("toggles aria-checked and reports the new value", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch defaultChecked onCheckedChange={onCheckedChange}>{"public"}</Switch>);
    const sw = screen.getByRole("switch", { name: "public" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("ignores clicks while disabled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch disabled onCheckedChange={onCheckedChange}>
        {"public"}
      </Switch>,
    );
    await userEvent.click(screen.getByRole("switch", { name: "public" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "public" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("Select", () => {
  const items = [
    { value: "3", label: "top 3" },
    { value: "10", label: "top 10" },
  ];

  it("picks an option from the keyboard and echoes its label, not its value", async () => {
    const onValueChange = vi.fn();
    render(
      <Select items={items} defaultValue="3" onValueChange={onValueChange}>
        <SelectTrigger aria-label="show">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "show" });
    expect(trigger).toHaveTextContent("top 3");
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(await screen.findByRole("option", { name: "top 10" }));
    expect(onValueChange).toHaveBeenLastCalledWith("10", expect.anything());
    expect(trigger).toHaveTextContent("top 10");
  });
});

describe("Pagination", () => {
  function Pager({ page, total, onPage }: { page: number; total: number; onPage: (n: number) => void }) {
    return (
      <Pagination aria-label="pages">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink disabled={page === 1} onClick={() => onPage(page - 1)}>
              {"prev"}
            </PaginationLink>
          </PaginationItem>
          {paginationRange(page, total).map((item, i) => (
            <PaginationItem key={i}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink isActive={item === page} onClick={() => onPage(item)}>
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationLink disabled={page === total} onClick={() => onPage(page + 1)}>
              {"next"}
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }

  it("windows pages around the current one with ellipses", () => {
    expect(paginationRange(1, 3)).toEqual([1, 2, 3]);
    expect(paginationRange(1, 38)).toEqual([1, 2, "ellipsis", 38]);
    expect(paginationRange(19, 38)).toEqual([1, "ellipsis", 18, 19, 20, "ellipsis", 38]);
    expect(paginationRange(38, 38)).toEqual([1, "ellipsis", 37, 38]);
    expect(paginationRange(1, 1)).toEqual([1]);
  });

  it("disables prev on the first page and next on the last", () => {
    const { rerender } = render(<Pager page={1} total={3} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
    rerender(<Pager page={3} total={3} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "prev" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
  });

  it("marks the current page and reports clicks on others", async () => {
    const onPage = vi.fn();
    render(<Pager page={19} total={38} onPage={onPage} />);
    expect(screen.getByRole("button", { name: "19" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "20" }));
    expect(onPage).toHaveBeenCalledWith(20);
  });
});

describe("Progress", () => {
  it("exposes its value as a progressbar", () => {
    render(<Progress value={58} aria-label="share" />);
    expect(screen.getByRole("progressbar", { name: "share" })).toHaveAttribute("aria-valuenow", "58");
  });
});

describe("Badge, Card, Table", () => {
  it("render their content", () => {
    render(
      <Card>
        <Badge variant="accent">{"codex"}</Badge>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{"date"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{"2026-11-12"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>,
    );
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "date" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2026-11-12" })).toBeInTheDocument();
  });
});
