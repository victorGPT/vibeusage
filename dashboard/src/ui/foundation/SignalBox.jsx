import React from "react";
import { copy } from "../../lib/copy";
import { DecodingText } from "./DecodingText.jsx";

// SignalBox — Landing-page variant of Panel with DecodingText title.
// SSOT: DESIGN.md §6.

export const SignalBox = ({
  title = copy("signalbox.title_default"),
  children,
  className = "",
}) => (
  <section
    className={`relative flex flex-col overflow-hidden border border-ink-muted bg-surface-strong ${className}`}
  >
    <header className="relative z-10 border-b border-ink-line px-4 py-3">
      <span className="text-caption text-ink-text">
        <DecodingText text={title} />
      </span>
    </header>
    <div className="relative z-10 flex-1 min-h-0 p-4">{children}</div>
  </section>
);
