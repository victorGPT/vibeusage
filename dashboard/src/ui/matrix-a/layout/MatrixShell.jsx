import React from "react";

import { MatrixRain } from "../components/MatrixRain.jsx";
import { copy } from "../../../lib/copy.js";

export function MatrixShell({
  headerRight,
  headerStatus,
  children,
  footerLeft,
  footerRight,
  contentClassName = "",
  rootClassName = "",
  hideHeader = false,
}) {
  const headerTitle = copy("shell.header.title");
  const titleParts = String(headerTitle || "").trim().split(/\s+/);
  const titlePrimary = titleParts[0] || headerTitle;
  const titleSecondary = titleParts.slice(1).join(" ");

  return (
    <div
      className={`min-h-screen bg-matrix-dark text-matrix-primary font-matrix p-4 md:p-8 flex flex-col leading-tight text-body selection:bg-matrix-primary selection:text-black overflow-hidden ${rootClassName}`}
    >
      <MatrixRain />
      <div className="matrix-scanline-overlay pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]"></div>

      <div
        className={`relative z-10 flex flex-col min-h-screen ${contentClassName}`}
      >
        {!hideHeader ? (
          <header className="flex justify-between border-b border-[#00FF41]/20 pb-3 mb-6 items-center shrink-0">
            <div className="flex items-center space-x-6">
              <div className="flex items-baseline gap-3 uppercase select-none">
                <span
                  className="text-[#00ff00] font-black text-2xl md:text-3xl glow-text"
                  style={{ letterSpacing: "-1px" }}
                >
                  {titlePrimary}
                </span>
                {titleSecondary ? (
                  <span
                    className="text-[#00ff00] font-extralight text-sm md:text-base"
                    style={{ letterSpacing: "2px" }}
                  >
                    {titleSecondary}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center space-x-4 text-caption text-matrix-muted uppercase font-bold">
                {headerStatus || (
                  <span className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-matrix-primary rounded-full mr-2 animate-pulse"></span>
                    {copy("shell.header.link_active")}
                  </span>
                )}
              </div>
            </div>

            {headerRight}
          </header>
        ) : null}

        <main className="flex-1">{children}</main>

        <footer className="mt-6 pt-3 border-t border-matrix-ghost flex justify-between text-caption uppercase font-bold tracking-[0.3em] text-matrix-dim shrink-0">
          <div className="flex space-x-10 items-center">
            {footerLeft || <span>{copy("shell.footer.help")}</span>}
          </div>
          <div className="flex items-center space-x-3">
            {footerRight || (
              <span className="font-bold">{copy("shell.footer.neural_index")}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
