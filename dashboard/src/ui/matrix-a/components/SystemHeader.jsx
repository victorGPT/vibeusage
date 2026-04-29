import React from "react";
import { copy } from "../../../lib/copy";

// Decorative band — chrome only, no semantic meaning.
// Uses ASCII text from copy.csv (system.header.katakana_deco) so the band stays
// legible on systems without CJK fonts installed (no tofu boxes).

export function SystemHeader({
  title = copy("system.header.title_default"),
  signalLabel,
  time,
  className = "",
}) {
  return (
    <header
      className={`flex justify-between border-b border-ink-line p-4 items-center shrink-0 bg-surface-raised ${className}`}
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
          className="hidden md:inline text-micro tracking-caps text-ink-line whitespace-nowrap select-none"
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
