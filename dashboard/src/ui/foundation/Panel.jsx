import React from "react";

// Panel — 1px hairline card with a SEPARATE little title box pinned to the
// top-left corner (like a tab). No header bar, no chip on a horizontal rule.
// SSOT: DESIGN.md §6 Component Contracts.
// variants: plain (default 1px border + raised surface), bare (no border, stacked sections)
// tone:     default, strong (chip / modal elevation)
// weight:   primary (hero — bumps border to ink-muted + adds shadow-glow-faint), secondary (default), tertiary (no-op, kept for API stability)
// stamped:  embeds corner labels (handle / period / logo) for self-contained screenshots

const VARIANT = {
  plain: "bg-surface-raised backdrop-blur-panel border border-ink-line",
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
  const isPrimary = weight === "primary";
  const primaryClass = isPrimary ? "border-ink-muted shadow-glow-faint" : "";
  const rootClass =
    `relative flex flex-col ${variantClass} ${toneClass} ${primaryClass} ${className}`.trim();

  // Title chip — independent little box pinned to the top-left corner (like
  // a tab); subtitle takes the same look pinned to the top-right.
  const hasTitleBox = Boolean(title || subtitle);
  const titleChipClass = isPrimary
    ? "border-ink-muted text-ink-bright"
    : "border-ink-line text-ink";
  const titleStyle = isPrimary
    ? { textShadow: "0 0 8px var(--ink-glow)" }
    : undefined;
  // Push the body down so it clears the absolutely-positioned title box.
  // Inline so it wins over caller-supplied bodyClassName (e.g. "py-3").
  const bodyStyle = hasTitleBox ? { paddingTop: 36 } : undefined;

  return (
    <div className={rootClass}>
      <CornerStamps
        stamped={stamped}
        stampHandle={stampHandle}
        stampPeriod={stampPeriod}
        stampLogo={stampLogo}
      />
      {title ? (
        <span
          className={`absolute top-2.5 left-3 z-[2] inline-flex items-center gap-1 border ${titleChipClass} bg-surface-strong px-2.5 py-1 text-micro uppercase leading-none whitespace-nowrap`}
          style={titleStyle}
        >
          {title}
        </span>
      ) : null}
      {subtitle ? (
        <span className="absolute top-2.5 right-3 z-[2] border border-ink-line bg-surface-strong px-2.5 py-1 text-micro uppercase leading-none text-ink-text">
          {subtitle}
        </span>
      ) : null}
      <div className={`px-4 py-4 ${bodyClassName}`} style={bodyStyle}>{children}</div>
    </div>
  );
}
