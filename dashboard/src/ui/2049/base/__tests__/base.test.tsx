import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CommandBox } from "../CommandBox";
import { Delta } from "../Delta";
import { RankRow } from "../RankRow";
import { Stamp } from "../Stamp";

describe("Delta", () => {
  it("shows a rise as an up triangle in the muted tone", () => {
    render(<Delta value={3} />);
    const mark = screen.getByText("▲ 3");
    expect(mark.className).toContain("text-muted-foreground");
  });

  it("shows a fall as a down triangle in red", () => {
    render(<Delta value={-2} suffix="vs last week" />);
    expect(screen.getByText("▼ 2").className).toContain("text-destructive");
    expect(screen.getByText("vs last week")).toBeTruthy();
  });

  it("shows no change as a dash", () => {
    render(<Delta value={0} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("Stamp", () => {
  it("truncates a long handle and range on one line and always keeps the site", () => {
    const handle = "an_unreasonably_long_handle_that_keeps_going_forever";
    render(<Stamp handle={handle} range="2025-11-13 → 2026-11-12 · all time since launch" />);
    const handleEl = screen.getByText(`@${handle}`);
    expect(handleEl.className).toContain("truncate");
    expect(screen.getByText(/all time since launch/).className).toContain("truncate");
    expect(screen.getByText("vibeusage.cc").className).not.toContain("truncate");
  });
});

describe("CommandBox", () => {
  it("copies the command and then says Copied", async () => {
    const user = userEvent.setup();
    render(<CommandBox command="npx --yes vibeusage init" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("npx --yes vibeusage init");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("announces Copied in a polite status region that is always present", async () => {
    const user = userEvent.setup();
    render(<CommandBox command="npx --yes vibeusage init" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it("goes back to Copy when the command changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommandBox command="npx --yes vibeusage init" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });
    rerender(<CommandBox command="npx --yes vibeusage sync" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("takes its own copy label and still copies the command", async () => {
    const user = userEvent.setup();
    render(<CommandBox command="https://example.test/guide.md" prefix="↳" copyLabel="Copy link" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await navigator.clipboard.readText()).toBe("https://example.test/guide.md");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});

describe("RankRow", () => {
  it("paints my row amber and leaves others plain", () => {
    const { container } = render(
      <>
        <RankRow rank="#7" user="your_handle · you" value="195.9M" delta={-2} me />
        <RankRow rank="#4" user="night_shift_dev" value="312.4M" delta={3} />
      </>,
    );
    const [mine, other] = Array.from(container.children) as HTMLElement[];
    expect(mine.className).toContain("bg-primary/8");
    expect(screen.getByText("your_handle · you").parentElement?.className).toContain("text-primary");
    expect(other.className).not.toContain("bg-primary/8");
    expect(screen.queryByText("Leader")).toBeNull();
  });

  it("marks the leader with a teal top rule and a Leader badge", () => {
    const { container } = render(<RankRow rank="#1" user="tokenfurnace" value="4.73B" lead />);
    expect((container.firstElementChild as HTMLElement).className).toContain("border-t-teal");
    expect(screen.getByText("Leader")).toBeTruthy();
  });

  it("omits the delta column when there is no delta", () => {
    render(<RankRow rank="#12" user="new_here" value="8.1M" />);
    expect(screen.queryByText("—")).toBeNull();
  });
});
