import React from "react";

// Panel — SSOT: DESIGN.md §6 Component Contracts.
// variants: ascii (signature), plain (default), bare (stacked sections)
// tone:     default, strong (chip / modal elevation)
// weight:   primary (hero, double-line ASCII), secondary (default), tertiary (faint)
// stamped:  embeds corner labels (handle / period / logo) for self-contained screenshots

const ASCII_WEIGHT = {
  primary: { TL: "╔", TR: "╗", BL: "╚", BR: "╝", H: "═", V: "║" },
  secondary: { TL: "┌", TR: "┐", BL: "└", BR: "┘", H: "─", V: "│" },
  tertiary: { TL: "·", TR: "·", BL: "·", BR: "·", H: "·", V: "·" },
};

const FRAME_TONE = {
  primary: "text-ink",
  secondary: "text-ink-muted",
  tertiary: "text-ink-faint",
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
  const variantClass = VARIANT[variant] ?? VARIANT.plain;
  const toneClass = TONE[tone] ?? TONE.default;
  const weightShadow = weight === "primary" ? "shadow-glow-sm" : "";
  const rootClass =
    `relative flex flex-col ${variantClass} ${toneClass} ${weightShadow} ${className}`.trim();

  const stamps = (
    <CornerStamps
      stamped={stamped}
      stampHandle={stampHandle}
      stampPeriod={stampPeriod}
      stampLogo={stampLogo}
    />
  );

  if (variant === "ascii") {
    const ASCII = ASCII_WEIGHT[weight] ?? ASCII_WEIGHT.secondary;
    const frameTone = FRAME_TONE[weight] ?? FRAME_TONE.secondary;
    return (
      <div className={rootClass}>
        {stamps}
        <div className="flex items-center leading-none">
          <span className={`shrink-0 ${frameTone}`}>{ASCII.TL}</span>
          {title ? (
            <span className="mx-3 shrink-0 px-2 py-1 text-heading text-ink uppercase bg-surface-strong border border-ink-faint">
              {title}
            </span>
          ) : null}
          {subtitle ? (
            <span className="mr-2 text-caption text-ink-text uppercase">[{subtitle}]</span>
          ) : null}
          <span className={`flex-1 overflow-hidden whitespace-nowrap ${frameTone}`}>
            {ASCII.H.repeat(100)}
          </span>
          <span className={`shrink-0 ${frameTone}`}>{ASCII.TR}</span>
        </div>

        <div className="flex flex-1">
          <div className={`shrink-0 w-3 flex justify-center ${frameTone}`}>{ASCII.V}</div>
          <div className={`flex-1 min-w-0 relative z-10 py-4 px-4 ${bodyClassName}`}>
            {children}
          </div>
          <div className={`shrink-0 w-3 flex justify-center ${frameTone}`}>{ASCII.V}</div>
        </div>

        <div className={`flex items-center leading-none ${frameTone}`}>
          <span className="shrink-0">{ASCII.BL}</span>
          <span className="flex-1 overflow-hidden whitespace-nowrap">{ASCII.H.repeat(100)}</span>
          <span className="shrink-0">{ASCII.BR}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {stamps}
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
