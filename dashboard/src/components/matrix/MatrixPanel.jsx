import React from "react";

const CHARS = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
};

const MatrixPanel = ({ title, children, className = "", subtitle = "" }) => (
  <div
    className={`relative flex flex-col bg-black/80 backdrop-blur-md border border-[#00FF41]/10 shadow-2xl ${className}`}
  >
    <div className="flex items-center leading-none">
      <span className="shrink-0 text-[#00FF41]/30">{CHARS.TOP_LEFT}</span>
      <span className="mx-2 shrink-0 font-black uppercase tracking-[0.2em] text-[#00FF41] px-2 py-0.5 bg-[#00FF41]/10 text-[9px] border border-[#00FF41]/20">
        {title}
      </span>
      {subtitle && (
        <span className="text-[8px] opacity-30 mr-2 tracking-tighter">
          [{subtitle}]
        </span>
      )}
      <span className="flex-1 overflow-hidden whitespace-nowrap opacity-10 text-[#00FF41]">
        {CHARS.HORIZONTAL.repeat(100)}
      </span>
      <span className="shrink-0 text-[#00FF41]/30">{CHARS.TOP_RIGHT}</span>
    </div>
    <div className="flex flex-1">
      <div className="shrink-0 w-3 flex justify-center opacity-10 text-[#00FF41]">
        {CHARS.VERTICAL}
      </div>
      <div className="flex-1 py-4 px-2 relative z-10 w-full">{children}</div>
      <div className="shrink-0 w-3 flex justify-center opacity-10 text-[#00FF41]">
        {CHARS.VERTICAL}
      </div>
    </div>
    <div className="flex items-center leading-none opacity-10 text-[#00FF41]">
      <span className="shrink-0">{CHARS.BOTTOM_LEFT}</span>
      <span className="flex-1 overflow-hidden whitespace-nowrap">
        {CHARS.HORIZONTAL.repeat(100)}
      </span>
      <span className="shrink-0">{CHARS.BOTTOM_RIGHT}</span>
    </div>
  </div>
);

export default MatrixPanel;
