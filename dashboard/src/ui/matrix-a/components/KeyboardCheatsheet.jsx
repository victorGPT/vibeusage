import React from "react";
import { copy } from "../../../lib/copy";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "../../shadcn/dialog";

// KeyboardCheatsheet — DESIGN.md §11 v3 keyboard layer.
// shadcn Dialog handles focus trap, initial focus, focus restore, Esc, and
// outside-click dismissal natively — no hand-rolled a11y wiring required.
// All visible text routed through copy.csv per AGENTS.md.

const KEY_ROWS = [
  ["?", "keyboard.cheatsheet.row.toggle"],
  ["d", "keyboard.cheatsheet.row.day"],
  ["w", "keyboard.cheatsheet.row.week"],
  ["m", "keyboard.cheatsheet.row.month"],
  ["t", "keyboard.cheatsheet.row.total"],
  ["r", "keyboard.cheatsheet.row.refresh"],
  ["s", "keyboard.cheatsheet.row.share"],
  ["esc", "keyboard.cheatsheet.row.close"],
];

export function KeyboardCheatsheet({ open, onClose }) {
  return (
    <Dialog
      open={!!open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <DialogContent
        aria-label={copy("keyboard.cheatsheet.aria_label")}
        className="max-w-md mx-4 bg-surface-strong border-ink font-mono gap-0 block"
      >
        <div className="flex items-baseline justify-between border-b border-ink-line pb-3 mb-4">
          <DialogTitle className="text-heading text-ink uppercase tracking-label font-normal">
            {copy("keyboard.cheatsheet.title")}
          </DialogTitle>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="text-micro text-ink-muted uppercase tracking-caps"
            >
              {copy("keyboard.cheatsheet.dismiss_hint")}
            </span>
            <DialogClose
              aria-label={copy("keyboard.cheatsheet.close_aria")}
              className="text-caption text-ink uppercase tracking-caps border border-ink-muted bg-surface px-2 py-0.5 hover:bg-ink-faint focus:outline-none focus-visible:border-ink"
            >
              {copy("keyboard.cheatsheet.close_label")}
            </DialogClose>
          </div>
        </div>
        <ul className="space-y-2">
          {KEY_ROWS.map(([key, descKey]) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 text-data"
            >
              <kbd className="inline-flex items-center justify-center min-w-[36px] h-7 px-2 border border-ink-muted bg-surface text-caption text-ink uppercase tracking-caps">
                {key}
              </kbd>
              <span className="flex-1 text-ink-text uppercase tracking-label text-caption">
                {copy(descKey)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 pt-3 border-t border-ink-faint text-micro text-ink-faint uppercase tracking-caps">
          {copy("keyboard.cheatsheet.footer_note")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
