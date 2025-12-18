import React from "react";
import MatrixPanel from "./MatrixPanel";

const MatrixTerminal = ({ title = "TERMINAL", commands = [] }) => {
  return (
    <MatrixPanel title={title} className="w-full">
      <div className="font-mono text-xs space-y-4">
        {commands.map((cmd, i) => (
          <div key={i}>
            <div className="opacity-50 mb-1 prose prose-invert max-w-none text-[10px] uppercase tracking-wider">
              # {cmd.description}
            </div>
            <div className="bg-[#00FF41]/10 border border-[#00FF41]/20 p-3 rounded text-[#00FF41] font-bold select-all">
              <span className="opacity-50 mr-2">$</span>
              {cmd.code}
            </div>
          </div>
        ))}
        <div className="animate-pulse opacity-50 text-[10px] mt-2">_</div>
      </div>
    </MatrixPanel>
  );
};

export default MatrixTerminal;
