import { copy } from "../../lib/copy";
import { MatrixRain } from "../matrix-a/components/MatrixRain.jsx";

// MatrixShell — SSOT: DESIGN.md §5 (fx-scanline single ambient layer), §2 (tokens).

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
  const titleParts = String(headerTitle || "")
    .trim()
    .split(/\s+/);
  const titlePrimary = titleParts[0] || headerTitle;
  const titleSecondary = titleParts.slice(1).join(" ");

  return (
    <div
      className={`min-h-screen bg-surface text-ink font-mono p-4 md:p-8 flex flex-col leading-tight text-body selection:bg-ink selection:text-surface overflow-hidden ${rootClassName}`}
    >
      <MatrixRain />
      <div className="fx-scanline pointer-events-none fixed inset-0 z-50"></div>

      <div
        className={`relative z-10 flex flex-col min-h-screen app-shell-content ${contentClassName}`}
      >
        {!hideHeader ? (
          <header className="border-b border-ink-line pb-3 mb-6 shrink-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3 md:gap-6">
                <img
                  src="/icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 bg-surface border border-ink-muted shadow-glow shrink-0"
                />
                <div className="flex min-w-0 items-baseline gap-2 md:gap-3 uppercase select-none">
                  <span className="text-ink text-heading md:text-display-2 tracking-tight glow-text leading-none truncate">
                    {titlePrimary}
                  </span>
                  {titleSecondary ? (
                    <span className="hidden sm:inline text-ink-text text-caption tracking-label truncate">
                      {titleSecondary}
                    </span>
                  ) : null}
                </div>
                <div className="hidden sm:flex items-center gap-4 text-caption text-ink-muted shrink-0">
                  {headerStatus || (
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-ink rounded-full mr-2 animate-pulse"></span>
                      {copy("shell.header.link_active")}
                    </span>
                  )}
                </div>
              </div>

              {headerRight ? (
                <div className="w-full md:w-auto md:ml-4">
                  <div className="w-full md:w-auto overflow-x-auto no-scrollbar">{headerRight}</div>
                </div>
              ) : null}
            </div>
          </header>
        ) : null}

        <main className="flex-1">{children}</main>

        <footer className="mt-6 pt-3 border-t border-ink-faint flex justify-between text-micro text-ink-muted shrink-0">
          <div className="flex gap-8 items-center">
            {footerLeft || <span>{copy("shell.footer.help")}</span>}
          </div>
          <div className="flex items-center gap-3">
            {footerRight || <span>{copy("shell.footer.neural_index")}</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
