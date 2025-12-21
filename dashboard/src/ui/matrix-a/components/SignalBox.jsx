import React from "react";
import { DecodingText } from "./DecodingText.jsx";

/**
 * Landing Page 专用的 AsciiBox 变体
 * (原 Landing.jsx 中的 AsciiBox，为了不与 dashboard 的 AsciiBox 冲突，命名为 SignalBox)
 */
export const SignalBox = ({ title = "SIGNAL", children, className = "" }) => (
  <div
    className={`relative flex flex-col bg-black/90 border border-[#00FF41]/30 shadow-2xl ${className}`}
  >
    <div className="flex items-center text-[#00FF41] leading-none text-[10px] p-1 border-b border-[#00FF41]/20">
      <span className="font-black bg-[#00FF41]/10 px-2 py-0.5 border border-[#00FF41]/30 mr-2">
        <DecodingText text={title} />
      </span>
      <span className="flex-1 opacity-10 truncate">
        --------------------------------------------------
      </span>
    </div>
    <div className="p-4 relative z-10 h-full">{children}</div>
    <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-[#00FF41] opacity-60"></div>
    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#00FF41] opacity-60"></div>
  </div>
);
