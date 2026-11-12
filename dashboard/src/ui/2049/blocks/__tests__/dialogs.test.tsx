import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CostAnalysisModal } from "../CostAnalysisModal";
import { KeyboardCheatsheet } from "../KeyboardCheatsheet";

const FLEET = [
  {
    label: "CODEX",
    usd: 12.5,
    models: [
      { id: "gpt-5", name: "GPT-5", share: 80, calc: "list" },
      { id: "o4", name: "o4-mini", share: 20, calc: null },
    ],
  },
  { label: "CLAUDE", usd: 7.5, models: [{ id: "opus", name: "Opus", share: 100, calc: "list" }] },
];

function WithTrigger({ kind }: { kind: "cost" | "keys" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {"open"}
      </button>
      {kind === "cost" ? (
        <CostAnalysisModal isOpen={open} onClose={() => setOpen(false)} fleetData={FLEET} />
      ) : (
        <KeyboardCheatsheet open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

describe("CostAnalysisModal", () => {
  it("lists every source with its cost, every model with its share, and the total", () => {
    render(<CostAnalysisModal isOpen onClose={() => {}} fleetData={FLEET} />);
    const dialog = screen.getByRole("dialog", { name: "Cost Breakdown" });
    const view = within(dialog);
    expect(view.getByText("$20.00")).toBeTruthy();
    expect(view.getByText("CODEX")).toBeTruthy();
    expect(view.getByText("$12.50")).toBeTruthy();
    expect(view.getByText("GPT-5 (80%)")).toBeTruthy();
    expect(view.getAllByText("CALC: LIST", { exact: false })).toHaveLength(2);
    expect(view.getByText("CALC: DYNAMIC", { exact: false })).toBeTruthy();
    expect(view.getByText("Opus (100%)")).toBeTruthy();
  });

  it("calls onClose once on Escape and once on the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<CostAnalysisModal isOpen onClose={onClose} fleetData={FLEET} />);
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<CostAnalysisModal isOpen onClose={onClose} fleetData={FLEET} />);
    await user.click(screen.getByRole("button", { name: "[ ESC ] CLOSE" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("takes focus when opened and hands it back to the trigger when closed", async () => {
    const user = userEvent.setup();
    render(<WithTrigger kind="cost" />);
    const trigger = screen.getByRole("button", { name: "open" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("KeyboardCheatsheet", () => {
  it("lists every shortcut key with its action", () => {
    render(<KeyboardCheatsheet open onClose={() => {}} />);
    const view = within(screen.getByRole("dialog", { name: "keymap.help" }));
    for (const key of ["?", "d", "w", "m", "t", "r", "s", "esc"]) {
      expect(view.getByText(key, { selector: "kbd" })).toBeTruthy();
    }
    expect(view.getByText("share screenshot to X")).toBeTruthy();
  });

  it("calls onClose on Escape and on the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<KeyboardCheatsheet open onClose={onClose} />);
    await act(async () => {
      await user.keyboard("{Escape}");
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Close shortcuts" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("takes focus when opened and hands it back to the trigger when closed", async () => {
    const user = userEvent.setup();
    render(<WithTrigger kind="keys" />);
    const trigger = screen.getByRole("button", { name: "open" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
