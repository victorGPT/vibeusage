import React from "react";

const MatrixInput = ({ label, ...props }) => {
  return (
    <label className="flex flex-col gap-1.5 font-mono text-xs text-[#00FF41]/70 uppercase tracking-wider">
      {label && <span className="opacity-70 font-bold">{label}</span>}
      <div className="relative group">
        <input
          className="w-full bg-[#050505] border border-[#00FF41]/30 text-[#00FF41] px-3 py-2 outline-none focus:border-[#00FF41] focus:shadow-[0_0_10px_rgba(0,255,65,0.15)] transition-all font-mono placeholder-[#00FF41]/30"
          {...props}
        />
        <div className="absolute inset-0 pointer-events-none border border-[#00FF41]/0 group-hover:border-[#00FF41]/20 transition-colors"></div>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-[#00FF41] opacity-50"></div>
        <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-[#00FF41] opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-[#00FF41] opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-[#00FF41] opacity-50"></div>
      </div>
    </label>
  );
};

export default MatrixInput;
