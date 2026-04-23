import React from "react";

// Panel — SSOT: DESIGN.md §6 Component Contracts.
// variants: ascii (signature), plain (default), bare (stacked sections)
// tone:     default, strong (chip / modal elevation)

const ASCII = {
  TL: "┌",
  TR: "┐",
  BL: "└",
  BR: "┘",
  H: "─",
  V: "│",
};

const VARIANT = {
  ascii: "bg-surface-raised backdrop-blur-panel shadow-panel",
  plain: "bg-surface-raised backdrop-blur-panel border border-ink-line shadow-panel",
  bare: "bg-surface-raised backdrop-blur-panel",
};

const TONE = {
  default: "",
  strong: "bg-surface-strong border-ink-muted",
};

export function Panel({
  variant = "plain",
  tone = "default",
  title,
  subtitle,
  className = "",
  bodyClassName = "",
  children,
}) {
  const variantClass = VARIANT[variant] ?? VARIANT.plain;
  const toneClass = TONE[tone] ?? TONE.default;
  const rootClass = `relative flex flex-col ${variantClass} ${toneClass} ${className}`.trim();

  if (variant === "ascii") {
    return (
      <div className={rootClass}>
        <div className="flex items-center leading-none">
          <span className="shrink-0 text-ink-muted">{ASCII.TL}</span>
          {title ? (
            <span className="mx-3 shrink-0 px-2 py-1 text-heading text-ink uppercase bg-surface-strong border border-ink-faint">
              {title}
            </span>
          ) : null}
          {subtitle ? (
            <span className="mr-2 text-caption text-ink-text uppercase">[{subtitle}]</span>
          ) : null}
          <span className="flex-1 overflow-hidden whitespace-nowrap text-ink-faint">
            {ASCII.H.repeat(100)}
          </span>
          <span className="shrink-0 text-ink-muted">{ASCII.TR}</span>
        </div>

        <div className="flex flex-1">
          <div className="shrink-0 w-3 flex justify-center text-ink-faint">{ASCII.V}</div>
          <div className={`flex-1 min-w-0 relative z-10 py-4 px-4 ${bodyClassName}`}>
            {children}
          </div>
          <div className="shrink-0 w-3 flex justify-center text-ink-faint">{ASCII.V}</div>
        </div>

        <div className="flex items-center leading-none text-ink-faint">
          <span className="shrink-0">{ASCII.BL}</span>
          <span className="flex-1 overflow-hidden whitespace-nowrap">{ASCII.H.repeat(100)}</span>
          <span className="shrink-0">{ASCII.BR}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {title || subtitle ? (
        <div className="flex items-baseline gap-3 px-4 pt-4">
          {title ? <span className="text-heading text-ink uppercase">{title}</span> : null}
          {subtitle ? (
            <span className="text-caption text-ink-text uppercase">[{subtitle}]</span>
          ) : null}
        </div>
      ) : null}
      <div className={`px-4 py-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
