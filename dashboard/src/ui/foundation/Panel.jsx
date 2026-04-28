import React from "react";

// Panel — single 1px hairline card.
// SSOT: DESIGN.md §6 Component Contracts (v3 — kit chat: "single 1px hairline").
// variants: plain (default 1px border + raised surface), bare (no border, stacked sections)
// tone:     default, strong (chip / modal elevation)
// weight:   primary (hero — adds shadow-glow-sm), secondary (default), tertiary (no-op, kept for API stability)
// stamped:  embeds corner labels (handle / period / logo) for self-contained screenshots

const VARIANT = {
  plain: "bg-surface-raised backdrop-blur-panel border border-ink-line shadow-panel",
  bare: "bg-surface-raised backdrop-blur-panel",
};

const TONE = {
  default: "",
  strong: "bg-surface-strong border-ink-muted",
};

function CornerStamps({ stamped, stampHandle, stampPeriod, stampLogo = "vibeusage.cc" }) {
  if (!stamped) return null;
  return (
    <>
      {stampHandle ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-surface-strong px-2 text-micro uppercase tracking-caps text-ink-muted"
        >
          @{stampHandle}
        </span>
      ) : null}
      {stampPeriod ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-0 -translate-y-1/2 bg-surface-strong px-2 text-micro uppercase tracking-caps text-ink-muted"
        >
          {stampPeriod}
        </span>
      ) : null}
      {stampLogo ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-0 translate-y-1/2 bg-surface-strong px-2 text-micro uppercase tracking-caps text-ink-faint"
        >
          {stampLogo}
        </span>
      ) : null}
    </>
  );
}

export function Panel({
  variant = "plain",
  tone = "default",
  weight = "secondary",
  stamped = false,
  stampHandle,
  stampPeriod,
  stampLogo,
  title,
  subtitle,
  className = "",
  bodyClassName = "",
  children,
}) {
  // Back-compat: legacy callers pass variant="ascii". The ASCII corner glyph
  // mode was removed in v3 — fold it into the plain hairline variant.
  const resolvedVariant = variant === "ascii" ? "plain" : variant;
  const variantClass = VARIANT[resolvedVariant] ?? VARIANT.plain;
  const toneClass = TONE[tone] ?? TONE.default;
  const weightShadow = weight === "primary" ? "shadow-glow-sm" : "";
  const rootClass =
    `relative flex flex-col ${variantClass} ${toneClass} ${weightShadow} ${className}`.trim();

  return (
    <div className={rootClass}>
      <CornerStamps
        stamped={stamped}
        stampHandle={stampHandle}
        stampPeriod={stampPeriod}
        stampLogo={stampLogo}
      />
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
