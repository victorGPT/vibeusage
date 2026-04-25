import React, { useEffect, useRef } from "react";
import { copy } from "../../../lib/copy";

// KeyboardCheatsheet — DESIGN.md §11 v3 keyboard layer.
// Static ASCII-styled overlay. Renders only when open=true.
// Esc / backdrop click both close (handled via onClose).
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
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    // Move initial focus onto the close button so the only focusable
    // control inside the modal owns focus from the start (a11y review).
    closeButtonRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  // Focus trap: with a single focusable control inside the dialog, any Tab /
  // Shift+Tab must keep focus pinned to the close button. Without this, a
  // keyboard user tabs out of the aria-modal back into the page underneath
  // (PR review red flag).
  function handleDialogKeyDown(event) {
    if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-surface/80 backdrop-blur-panel"
      role="dialog"
      aria-modal="true"
      aria-label={copy("keyboard.cheatsheet.aria_label")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="relative w-full max-w-md mx-4 bg-surface-strong border border-ink shadow-glow font-mono p-6 outline-none"
      >
        <div className="flex items-baseline justify-between border-b border-ink-line pb-3 mb-4">
          <span className="text-heading text-ink uppercase tracking-label">
            {copy("keyboard.cheatsheet.title")}
          </span>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="text-micro text-ink-muted uppercase tracking-caps"
            >
              {copy("keyboard.cheatsheet.dismiss_hint")}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={copy("keyboard.cheatsheet.close_aria")}
              className="text-caption text-ink uppercase tracking-caps border border-ink-muted bg-surface px-2 py-0.5 hover:bg-ink-faint focus:outline-none focus-visible:border-ink"
            >
              {copy("keyboard.cheatsheet.close_label")}
            </button>
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
      </div>
    </div>
  );
}
