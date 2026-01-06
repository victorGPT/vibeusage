import React from "react";

export const ASCII_CHARS = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
};

export function AsciiBox({
  title,
  subtitle,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <div
      className={`relative flex flex-col matrix-panel ${className}`}
    >
      <div className="flex items-center leading-none">
        <span className="shrink-0 text-matrix-dim">{ASCII_CHARS.TOP_LEFT}</span>
        <span className="mx-3 shrink-0 text-heading uppercase text-matrix-primary px-2 py-1 bg-matrix-panelStrong border border-matrix-ghost">
          {title}
        </span>
        {subtitle ? (
          <span className="text-caption text-matrix-muted mr-2 uppercase">
            [{subtitle}]
          </span>
        ) : null}
        <span className="flex-1 overflow-hidden whitespace-nowrap text-matrix-ghost">
          {ASCII_CHARS.HORIZONTAL.repeat(100)}
        </span>
        <span className="shrink-0 text-matrix-dim">{ASCII_CHARS.TOP_RIGHT}</span>
      </div>

      <div className="flex flex-1">
        <div className="shrink-0 w-3 flex justify-center text-matrix-ghost">
          {ASCII_CHARS.VERTICAL}
        </div>
        <div className={`flex-1 min-w-0 py-5 px-4 relative z-10 ${bodyClassName}`}>
          {children}
        </div>
        <div className="shrink-0 w-3 flex justify-center text-matrix-ghost">
          {ASCII_CHARS.VERTICAL}
        </div>
      </div>

      <div className="flex items-center leading-none text-matrix-ghost">
        <span className="shrink-0">{ASCII_CHARS.BOTTOM_LEFT}</span>
        <span className="flex-1 overflow-hidden whitespace-nowrap">
          {ASCII_CHARS.HORIZONTAL.repeat(100)}
        </span>
        <span className="shrink-0">{ASCII_CHARS.BOTTOM_RIGHT}</span>
      </div>
    </div>
  );
}
