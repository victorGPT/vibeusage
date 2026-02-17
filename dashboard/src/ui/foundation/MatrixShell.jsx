import React, { useEffect, useState } from "react";

import { MatrixRain } from "../matrix-a/components/MatrixRain.jsx";
import { copy } from "../../lib/copy";

function readStoredDayTheme() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem("vibeusage:dashboard-theme") === "day";
  } catch {
    return false;
  }
}

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
  const [isDayTheme, setIsDayTheme] = useState(readStoredDayTheme);
  const [headerIconSrc, setHeaderIconSrc] = useState(() =>
    readStoredDayTheme() ? "/icon-day.svg" : "/icon.svg"
  );
  const headerTitle = copy("shell.header.title");
  const titleParts = String(headerTitle || "").trim().split(/\s+/);
  const titlePrimary = titleParts[0] || headerTitle;
  const titleSecondary = titleParts.slice(1).join(" ");

  useEffect(() => {
    if (typeof document === "undefined") return () => {};
    const root = document.documentElement;
    const syncIconSrc = () => {
      const theme = root.getAttribute("data-dashboard-theme");
      const dayTheme = theme === "day";
      setIsDayTheme(dayTheme);
      setHeaderIconSrc(dayTheme ? "/icon-day.svg" : "/icon.svg");
    };
    syncIconSrc();
    if (typeof MutationObserver !== "function") return () => {};
    const observer = new MutationObserver(syncIconSrc);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-dashboard-theme"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={`min-h-screen bg-matrix-dark text-matrix-primary font-matrix p-4 md:p-8 flex flex-col leading-tight text-body selection:bg-matrix-primary selection:text-black overflow-hidden ${rootClassName}`}
    >
      <MatrixRain />
      <div className="matrix-scanline-overlay pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]"></div>

      <div
        className={`relative z-10 flex flex-col min-h-screen matrix-shell-content ${contentClassName}`}
      >
        {!hideHeader ? (
          <header className="border-b border-matrix-primary/20 pb-3 mb-6 shrink-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3 md:gap-6">
                <img
                  src={headerIconSrc}
                  alt=""
                  aria-hidden="true"
                  className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-sm shrink-0 ${
                    isDayTheme
                      ? "bg-white border border-black/20 shadow-[0_2px_8px_rgba(0,0,0,0.14)]"
                      : "bg-black border border-matrix-primary/30 shadow-[0_0_12px_rgba(0,255,65,0.35)]"
                  }`}
                />
                <div className="flex min-w-0 items-baseline gap-2 md:gap-3 uppercase select-none">
                  <span
                    className="text-matrix-primary font-black text-xl sm:text-2xl md:text-3xl glow-text leading-none truncate"
                    style={{ letterSpacing: "-1px" }}
                  >
                    {titlePrimary}
                  </span>
                  {titleSecondary ? (
                    <span
                      className="hidden sm:inline text-matrix-primary font-extralight text-xs md:text-base truncate"
                      style={{ letterSpacing: "2px" }}
                    >
                      {titleSecondary}
                    </span>
                  ) : null}
                </div>
                <div className="hidden sm:flex items-center space-x-4 text-caption text-matrix-muted uppercase font-bold shrink-0">
                  {headerStatus || (
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-matrix-primary rounded-full mr-2 animate-pulse"></span>
                      {copy("shell.header.link_active")}
                    </span>
                  )}
                </div>
              </div>

              {headerRight ? (
                <div className="w-full md:w-auto md:ml-4">
                  <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
                    {headerRight}
                  </div>
                </div>
              ) : null}
            </div>
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
