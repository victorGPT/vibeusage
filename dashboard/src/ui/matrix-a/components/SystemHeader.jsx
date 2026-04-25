import React from "react";
import { copy } from "../../../lib/copy";

// Decorative katakana band — chrome only, no semantic meaning.
// DESIGN.md §5 v3 deco-katakana. Removing it must not lose information.
// Text source: copy.csv (system.header.katakana_deco) per AGENTS.md.

export function SystemHeader({
  title = copy("system.header.title_default"),
  signalLabel,
  time,
  className = "",
}) {
  return (
    <header
      className={`flex justify-between border-b border-ink-faint p-4 items-center shrink-0 bg-surface-raised ${className}`}
    >
      <div className="flex items-center space-x-4">
        <div className="bg-ink text-surface px-2 py-1 font-black text-heading uppercase skew-x-[-10deg] border border-ink shadow-glow-sm">
          {title}
        </div>
        {signalLabel ? (
          <span className="text-caption text-ink-text hidden sm:inline font-bold uppercase animate-pulse">
            {signalLabel}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="deco-katakana hidden md:inline text-micro"
        >
          {copy("system.header.katakana_deco")}
        </span>
      </div>
      {time ? (
        <div className="text-ink font-bold text-body tracking-caps">{time}</div>
      ) : null}
    </header>
  );
}
