import React, { useMemo } from "react";

import { MatrixRain } from "../../../components/MatrixRain.jsx";

export function MatrixShell({
  headerRight,
  headerStatus,
  children,
  footerLeft,
  footerRight,
}) {
  const reduceMotion = useMemo(() => {
    return Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono p-4 md:p-8 flex flex-col leading-tight text-[11px] md:text-[12px] selection:bg-[#00FF41] selection:text-black overflow-hidden">
      {!reduceMotion ? <MatrixRain /> : null}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.06)_50%)] bg-[length:100%_4px] opacity-20"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="flex justify-between border-b border-[#00FF41]/20 pb-3 mb-6 items-center shrink-0">
          <div className="flex items-center space-x-6">
            <div className="bg-[#00FF41] text-black px-3 py-1 font-black text-xs">
              VIBE_SYSTEM_A
            </div>
            <div className="flex items-center space-x-4 opacity-50 text-[9px] tracking-widest font-black uppercase">
              {headerStatus || (
                <span className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full mr-2 animate-pulse"></span>
                  Link_Active
                </span>
              )}
            </div>
          </div>

          {headerRight}
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-6 pt-3 border-t border-[#00FF41]/10 flex justify-between opacity-30 text-[8px] uppercase font-black tracking-[0.3em] shrink-0">
          <div className="flex space-x-10 items-center">
            {footerLeft || <span>[F1] Help</span>}
          </div>
          <div className="flex items-center space-x-3">
            {footerRight || <span className="font-bold">Neural_Index: 0.942.A1</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
