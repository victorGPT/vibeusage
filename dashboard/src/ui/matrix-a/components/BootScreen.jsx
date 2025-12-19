import React from "react";

export function BootScreen({ onSkip }) {
  const canSkip = Boolean(onSkip);

  return (
    <div
      className={`min-h-screen bg-black text-[#00FF41] font-mono flex flex-col items-center justify-center p-8 text-center ${
        canSkip ? "cursor-pointer" : ""
      }`}
      onClick={canSkip ? onSkip : undefined}
      role={canSkip ? "button" : undefined}
      tabIndex={canSkip ? 0 : undefined}
      onKeyDown={
        canSkip
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSkip?.();
            }
          : undefined
      }
      aria-label={canSkip ? "Skip boot screen" : undefined}
    >
      <pre className="text-[8px] leading-[1.2] mb-6 opacity-80 select-none">
        {`
██╗   ██╗██╗██████╗ ███████╗███████╗ ██████╗  ██████╗ ██████╗ ███████╗
██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔════╝ ██╔═══██╗██╔══██╗██╔════╝
██║   ██║██║██████╔╝█████╗  ███████╗██║      ██║   ██║██████╔╝█████╗
╚██╗ ██╔╝██║██╔══██╗██╔══╝  ╚════██║██║      ██║   ██║██╔══██╗██╔══╝
 ╚████╔╝ ██║██████╔╝███████╗███████║╚██████╗ ╚██████╔╝██║  ██║███████╗
  ╚═══╝  ╚═╝╚═════╝ ╚══════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝
`}
      </pre>
      <div className="animate-pulse tracking-[0.5em] text-xs font-bold mb-4">
        WAKE UP, OPERATOR...
      </div>
      <div className="w-64 h-1 bg-[#003300] relative overflow-hidden">
        <div className="absolute inset-0 bg-[#00FF41] animate-[loader_2s_linear_infinite]"></div>
      </div>
      {canSkip ? (
        <p className="mt-6 text-[9px] opacity-30 tracking-widest uppercase">
          Click to skip
        </p>
      ) : null}
      <style>{`@keyframes loader { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}
