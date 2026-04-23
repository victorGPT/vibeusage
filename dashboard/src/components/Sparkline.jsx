import React from "react";
import { copy } from "../lib/copy";
import { toFiniteNumber } from "../lib/format";
import { COLORS } from "../ui/matrix-a/components/MatrixConstants";

export function Sparkline({ rows }) {
  const values = (rows || [])
    .map((r) => toFiniteNumber(r?.billable_total_tokens ?? r?.total_tokens))
    .filter((n) => typeof n === "number");
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const w = 720;
  const h = 120;
  const padX = 8;
  const padY = 10;

  const pts = values.map((v, i) => {
    const x = padX + (i * (w - padX * 2)) / (values.length - 1);
    const y = padY + (1 - (v - min) / span) * (h - padY * 2);
    return { x, y };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="120"
      aria-label={copy("sparkline.aria_label")}
    >
      <path
        className="drop-shadow-glow-faint"
        d={d}
        fill="none"
        stroke={COLORS.MATRIX}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
