import React, { useMemo, useRef, useState } from "react";

// --- Trend Monitor (NeuralFluxMonitor v2.0) ---
// Industrial TUI style: independent axes, precise grid, physical partitions.
export function TrendMonitor({
  rows,
  data = [],
  color = "#00FF41",
  label = "TREND",
  from,
  to,
  period,
}) {
  const series = Array.isArray(rows) && rows.length ? rows : null;
  const fallbackValues = data.length > 0 ? data : Array.from({ length: 24 }, () => 0);
  const seriesValues = series
    ? series.map((row) => {
        if (row?.missing || row?.future) return null;
        const raw = row?.total_tokens ?? row?.value;
        if (raw == null) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      })
    : fallbackValues;
  const seriesLabels = series
    ? series.map((row) => row?.hour || row?.day || row?.month || row?.label || "")
    : [];
  const seriesMeta = series
    ? series.map((row) => ({
        missing: Boolean(row?.missing),
        future: Boolean(row?.future),
      }))
    : Array.from({ length: seriesValues.length }, () => ({
        missing: false,
        future: false,
      }));
  const statsValues = seriesValues.filter((val) => Number.isFinite(val));
  const max = Math.max(...(statsValues.length ? statsValues : [0]), 100);
  const avg = statsValues.length
    ? statsValues.reduce((a, b) => a + b, 0) / statsValues.length
    : 0;

  const width = 100;
  const height = 100;
  const axisWidth = 8;
  const plotWidth = width - axisWidth;
  const pointCount = Math.max(seriesValues.length, 1);
  const step = pointCount > 1 ? plotWidth / (pointCount - 1) : 0;
  const xPadding =
    pointCount > 1 ? Math.min(step / 2, plotWidth * 0.12) : plotWidth / 2;
  const plotSpan = Math.max(plotWidth - xPadding * 2, 0);
  const stepWithPadding =
    pointCount > 1 ? plotSpan / (pointCount - 1) : 0;
  const plotTop = 4;
  const plotBottom = 4;
  const plotHeight = height - plotTop - plotBottom;

  function parseDate(value) {
    if (!value) return null;
    const parts = String(value).trim().split("-");
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    return new Date(Date.UTC(y, m, d));
  }

  function formatAxisDate(dt) {
    if (!dt) return "";
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${mm}-${dd}`;
  }

  const MONTH_LABELS = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  function formatMonth(dt) {
    if (!dt) return "";
    const yy = String(dt.getUTCFullYear()).slice(-2);
    return `${MONTH_LABELS[dt.getUTCMonth()]} ${yy}`;
  }

  function parseMonth(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const parts = raw.split("-");
    if (parts.length !== 2) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    return new Date(Date.UTC(y, m, 1));
  }

  function pickLabelIndices(length) {
    if (length <= 1) return [0];
    const last = length - 1;
    const steps = [0, 0.25, 0.5, 0.75, 1];
    return steps.map((ratio) => Math.round(last * ratio));
  }

  function formatAxisLabel(raw) {
    if (!raw) return "";
    if (period === "total") {
      return formatMonth(parseMonth(raw));
    }
    return formatAxisDate(parseDate(raw));
  }

  function buildXAxisLabels() {
    if (period === "day") {
      return ["00:00", "06:00", "12:00", "18:00", "23:00"];
    }
    if (seriesLabels.length > 0) {
      const indices = pickLabelIndices(seriesLabels.length);
      const labels = indices.map((idx) => formatAxisLabel(seriesLabels[idx] || ""));
      if (labels.some((label) => label)) return labels;
    }
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end || end < start) {
      return ["-24H", "-18H", "-12H", "-6H", "NOW"];
    }
    const totalMs = end.getTime() - start.getTime();
    const steps = [0, 0.25, 0.5, 0.75, 1];
    if (period === "total") {
      return steps.map((ratio) =>
        formatMonth(new Date(start.getTime() + totalMs * ratio))
      );
    }
    return steps.map((ratio) =>
      formatAxisDate(new Date(start.getTime() + totalMs * ratio))
    );
  }

  function formatCompact(value) {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) {
      const fixed = abs >= 1e10 ? 0 : 1;
      return `${(n / 1e9).toFixed(fixed)}B`;
    }
    if (abs >= 1e6) {
      const fixed = abs >= 1e7 ? 0 : 1;
      return `${(n / 1e6).toFixed(fixed)}M`;
    }
    if (abs >= 1e3) {
      const fixed = abs >= 1e4 ? 0 : 1;
      return `${(n / 1e3).toFixed(fixed)}K`;
    }
    return String(Math.round(n));
  }

  function formatFull(value) {
    const n = Number(value) || 0;
    return n.toLocaleString();
  }

  function formatTooltipLabel(label) {
    if (!label) return "UTC";
    const isoHour = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$/;
    const isoDay = /^\\d{4}-\\d{2}-\\d{2}$/;
    const isoMonth = /^\\d{4}-\\d{2}$/;

    if (isoHour.test(label)) {
      const [date, time] = label.split("T");
      const hh = time.slice(0, 2);
      return `${date} ${hh}:00 UTC`;
    }
    if (isoDay.test(label)) return `${label} UTC`;
    if (isoMonth.test(label)) return `${label} UTC`;
    return label;
  }

  const lineSegments = useMemo(() => {
    const segments = [];
    let current = [];
    seriesValues.forEach((val, i) => {
      if (!Number.isFinite(val)) {
        if (current.length) {
          segments.push(current);
          current = [];
        }
        return;
      }
      const x =
        pointCount > 1 ? xPadding + i * stepWithPadding : plotWidth / 2;
      const normalizedVal = max > 0 ? val / max : 0;
      const y = plotTop + (1 - normalizedVal) * plotHeight;
      current.push({ x, y, index: i, value: val });
    });
    if (current.length) segments.push(current);
    return segments;
  }, [max, plotHeight, plotTop, plotWidth, pointCount, seriesValues, stepWithPadding, xPadding]);

  const missingPoints = useMemo(() => {
    if (!series || seriesValues.length === 0) return [];
    return seriesMeta
      .map((meta, i) => {
        if (!meta?.missing || meta?.future) return null;
        const x =
          pointCount > 1 ? xPadding + i * stepWithPadding : plotWidth / 2;
        const y = plotTop + plotHeight;
        return { x, y, index: i };
      })
      .filter(Boolean);
  }, [
    plotHeight,
    plotTop,
    plotWidth,
    pointCount,
    series,
    seriesMeta,
    seriesValues.length,
    stepWithPadding,
    xPadding,
  ]);
  const xLabels = useMemo(() => buildXAxisLabels(), [from, period, to]);

  const plotRef = useRef(null);
  const [hover, setHover] = useState(null);

  function handleMove(e) {
    const el = plotRef.current;
    if (!el || seriesValues.length === 0) return;
    const rect = el.getBoundingClientRect();
    const axisWidthPx = (axisWidth / width) * rect.width;
    const plotWidthPx = rect.width - axisWidthPx;
    const rawX = Math.min(Math.max(e.clientX - rect.left, 0), plotWidthPx);
    const xPaddingPx = plotWidth > 0 ? (xPadding / plotWidth) * plotWidthPx : 0;
    const plotSpanPx = Math.max(plotWidthPx - xPaddingPx * 2, 0);
    const denom = Math.max(seriesValues.length - 1, 1);
    const clamped = Math.min(Math.max(rawX - xPaddingPx, 0), plotSpanPx);
    const ratio = plotSpanPx > 0 ? clamped / plotSpanPx : 0;
    const index = Math.round(ratio * denom);
    const meta = seriesMeta[index] || {};
    if (meta.future) {
      setHover(null);
      return;
    }
    const rawValue = seriesValues[index];
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    const snappedX =
      denom > 0 ? xPaddingPx + (index / denom) * plotSpanPx : plotWidthPx / 2;
    const labelText = seriesLabels[index] || "";
    const yRatio = max > 0 ? 1 - value / max : 1;
    const yPx =
      (plotTop / height) * rect.height +
      yRatio * (plotHeight / height) * rect.height;
    setHover({
      index,
      value,
      label: labelText,
      x: snappedX,
      y: yPx,
      rectWidth: rect.width,
      axisWidthPx,
      plotWidthPx,
      missing: Boolean(meta.missing),
    });
  }

  function handleLeave() {
    setHover(null);
  }

  return (
    <div className="w-full h-full min-h-[160px] flex flex-col relative group select-none bg-[#050505] border border-white/10 p-1">
      <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1">
        <span className="shrink-0 font-black uppercase tracking-[0.2em] text-[#00FF41] px-2 py-0.5 bg-[#00FF41]/10 text-[9px] border border-[#00FF41]/20">
          {label}
        </span>
        <div className="flex gap-3 text-[8px] font-mono text-[#00FF41]/50">
          <span>MAX: {Math.round(max)}</span>
          <span>AVG: {Math.round(avg)}</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden border border-white/5 bg-black/40">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${color} 1px, transparent 1px),
              linear-gradient(to bottom, ${color} 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FF41]/10 to-transparent w-[50%] h-full animate-[scan-x_3s_linear_infinite] pointer-events-none mix-blend-screen" />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full preserve-3d absolute inset-0 z-10"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {lineSegments.map((segment, idx) => {
            if (segment.length < 2) {
              const pt = segment[0];
              return (
                <circle
                  key={`seg-dot-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="2"
                  fill={color}
                  opacity="0.9"
                  className="drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]"
                />
              );
            }
            const points = segment.map((pt) => `${pt.x},${pt.y}`).join(" ");
            const first = segment[0];
            const last = segment[segment.length - 1];
            const fillPath = `M${points} L${last.x},${height - plotBottom} L${first.x},${
              height - plotBottom
            } Z`;
            return (
              <React.Fragment key={`seg-${idx}`}>
                <path d={fillPath} fill={`url(#grad-${label})`} />
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  className="drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]"
                />
              </React.Fragment>
            );
          })}
          {missingPoints.map((pt) => (
            <circle
              key={`missing-${pt.index}`}
              cx={pt.x}
              cy={pt.y}
              r="2.2"
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.8"
            />
          ))}
        </svg>

        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-1 px-1 text-[7px] font-mono text-[#00FF41]/60 pointer-events-none bg-black/60 backdrop-blur-[1px] border-l border-white/5 w-8 text-right">
          <span>{formatCompact(max)}</span>
          <span>{formatCompact(max * 0.75)}</span>
          <span>{formatCompact(max * 0.5)}</span>
          <span>{formatCompact(max * 0.25)}</span>
          <span>0</span>
        </div>

        <div
          ref={plotRef}
          className="absolute inset-0 z-20"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        ></div>

        {hover ? (
          <>
            <div
              className="absolute inset-y-0 left-0 pointer-events-none z-25"
              style={{ right: hover.axisWidthPx }}
            >
              <div
                className="absolute top-0 bottom-0 w-px bg-[#00FF41]/40 shadow-[0_0_6px_rgba(0,255,65,0.35)]"
                style={{ left: hover.x }}
              ></div>
              <div
                className="absolute w-2 h-2 rounded-full bg-[#00FF41] shadow-[0_0_6px_rgba(0,255,65,0.8)]"
                style={{ left: hover.x - 4, top: hover.y - 4 }}
              ></div>
            </div>
            <div
              className="absolute z-30 px-2 py-1 text-[9px] font-mono bg-black/90 border border-[#00FF41]/30 text-[#00FF41] pointer-events-none"
              style={{
                left: Math.min(
                  hover.x + 10,
                  hover.rectWidth - hover.axisWidthPx - 120
                ),
                top: Math.max(hover.y - 24, 6),
              }}
            >
              <div className="opacity-70">
                {formatTooltipLabel(hover.label)}
              </div>
              {hover.missing ? (
                <div className="font-bold">未同步</div>
              ) : (
                <div className="font-bold">{formatFull(hover.value)} tokens</div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="h-4 flex justify-between items-center px-1 mt-1 text-[8px] font-mono text-[#00FF41]/40 border-t border-white/5 pt-1">
        {xLabels.map((labelText, idx) => (
          <span
            key={`${labelText}-${idx}`}
            className={
              labelText === "NOW" ? "text-[#00FF41] font-bold animate-pulse" : ""
            }
          >
            {labelText}
          </span>
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan-x {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `,
        }}
      />
    </div>
  );
}
