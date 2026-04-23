import React, { useMemo } from "react";
import { copy } from "../../lib/copy";
import { COLORS } from "../matrix-a/components/MatrixConstants";

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function MatrixAvatar({
  name = "unknown",
  isAnon = false,
  isTheOne = false,
  size = 64,
  className = "",
}) {
  const hash = useMemo(() => hashCode(String(name || "unknown")), [name]);
  const grid = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 15; i += 1) {
      cells.push(((hash >> i) & 1) === 1);
    }
    return cells;
  }, [hash]);

  const color = isAnon ? COLORS.ANON : isTheOne ? COLORS.GOLD : COLORS.MATRIX;
  const glowClass = isAnon ? "" : isTheOne ? "drop-shadow-crown" : "drop-shadow-glow-sm";

  if (isAnon) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-surface-raised border border-ink-faint flex items-center justify-center overflow-hidden ${className}`}
      >
        <span className="text-ink font-black text-body opacity-60">
          {copy("shared.placeholder.anon_mark")}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative p-1 transition-transform duration-300 hover:scale-105 ${
        isTheOne
          ? "bg-yellow-900/20 border border-yellow-500/50"
          : "bg-surface-strong border border-ink-muted"
      } ${className}`}
    >
      {isTheOne ? (
        <div className="absolute inset-0 bg-ink-bright opacity-10 animate-pulse mix-blend-overlay"></div>
      ) : null}

      <svg viewBox="0 0 5 5" className={`w-full h-full ${glowClass}`}>
        {grid.map((filled, i) => {
          if (!filled) return null;
          const r = Math.floor(i / 3);
          const c = i % 3;
          return (
            <React.Fragment key={i}>
              <rect x={c} y={r} width="1" height="1" fill={color} />
              {c < 2 ? <rect x={4 - c} y={r} width="1" height="1" fill={color} /> : null}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
}
