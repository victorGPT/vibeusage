import React, { useMemo } from "react";

import { AsciiBox } from "./AsciiBox.jsx";

function SeismographLine({ data }) {
  const pointsData = useMemo(() => {
    const values = Array.isArray(data)
      ? data.map((val) => Number(val) || 0)
      : [];
    const max = Math.max(...values, 1);
    const height = 100;
    const width = 300;
    const points = values
      .map((val, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * width;
        const y = height - (val / max) * height * 0.8 - 10;
        return `${x},${y}`;
      })
      .join(" ");
    const fillPath = `${points} ${width},${height} 0,${height}`;

    return { max, points, fillPath };
  }, [data]);

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-[10px] opacity-40">No signal data.</div>;
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#00FF41]/5 border border-[#00FF41]/10">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_95%,rgba(0,255,65,0.2)_100%)] bg-[length:20px_100%] animate-[scan_4s_linear_infinite] pointer-events-none"></div>
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 px-2 py-2">
        <div className="border-t border-dashed border-[#00FF41]"></div>
        <div className="border-t border-dashed border-[#00FF41]"></div>
        <div className="border-t border-dashed border-[#00FF41]"></div>
      </div>
      <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flux-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF41" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00FF41" stopOpacity="0" />
          </linearGradient>
          <filter id="flux-neon">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={`M${pointsData.fillPath} Z`} fill="url(#flux-glow)" />
        <polyline
          points={pointsData.points}
          fill="none"
          stroke="#00FF41"
          strokeWidth="2"
          filter="url(#flux-neon)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute top-2 right-2 text-[9px] font-bold text-[#00FF41] bg-black/80 px-2 border border-[#00FF41]">
        PEAK: {pointsData.max}k
      </div>
    </div>
  );
}

export function NeuralFluxMonitor({ data, className = "" }) {
  return (
    <AsciiBox title="Neural_Flux_Monitor" className={className}>
      <div className="h-48">
        <SeismographLine data={data} />
      </div>
    </AsciiBox>
  );
}
