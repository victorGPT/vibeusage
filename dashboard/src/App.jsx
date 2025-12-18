import React, { useMemo } from "react";
import { useAuth } from "./hooks/useAuth";
import { useVibeData } from "./hooks/useVibeData";
import MatrixRain from "./components/matrix/MatrixRain";
import AuthView from "./components/domain/AuthView";
import DashboardView from "./components/domain/DashboardView";
import MatrixPanel from "./components/matrix/MatrixPanel";
import MatrixButton from "./components/matrix/MatrixButton";

export default function App() {
  const { auth, setAuth, logout, signedIn } = useAuth();
  const vibeData = useVibeData(auth);
  const { baseUrl } = vibeData;

  const isLocalhost = useMemo(() => {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }, []);

  const installCmds = {
    init: isLocalhost
      ? "node bin/tracker.js init"
      : "npx --yes @vibescore/tracker init",
    sync: isLocalhost
      ? "node bin/tracker.js sync"
      : "npx --yes @vibescore/tracker sync",
  };

  const routePath = useMemo(
    () => window.location.pathname.replace(/\/+$/, "") || "/",
    []
  );
  const isConnectPage = routePath === "/connect";

  // Authentication URL logic (redirects)
  const redirectUrl = useMemo(
    () => `${window.location.origin}/auth/callback`,
    []
  );
  const signInUrl = useMemo(() => {
    const u = new URL("/auth/sign-in", baseUrl);
    u.searchParams.set("redirect", redirectUrl);
    return u.toString();
  }, [baseUrl, redirectUrl]);

  const signUpUrl = useMemo(() => {
    const u = new URL("/auth/sign-up", baseUrl);
    u.searchParams.set("redirect", redirectUrl);
    return u.toString();
  }, [baseUrl, redirectUrl]);

  return (
    <div className="min-h-screen relative font-mono text-[#00FF41] selection:bg-[#00FF41] selection:text-black">
      {/* Background Layer */}
      <MatrixRain />
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.06)_50%)] bg-[length:100%_4px] opacity-20"></div>

      {/* Main Content Layer */}
      <div className="relative z-10 container mx-auto p-4 md:p-8 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex justify-between border-b border-[#00FF41]/20 pb-3 mb-8 items-center shrink-0">
          <div className="flex items-center space-x-6">
            <div className="bg-[#00FF41] text-black px-3 py-1 font-black text-xs">
              VIBE_SYSTEM_v2
            </div>
            <div className="hidden sm:flex items-center space-x-4 opacity-50 text-[9px] tracking-widest font-black uppercase">
              <span className="flex items-center">
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-2 ${
                    signedIn || isConnectPage
                      ? "bg-[#00FF41] animate-pulse"
                      : "bg-red-500"
                  }`}
                ></span>
                {signedIn ? "LINK_ESTABLISHED" : "NO_SIGNAL"}
              </span>
              <span>MEM_OPTIMIZED</span>
            </div>
          </div>

          {!signedIn && !isConnectPage && (
            <div className="flex space-x-4">
              <a href={signInUrl} className="no-underline">
                <MatrixButton className="text-[10px] py-1">LOGIN</MatrixButton>
              </a>
              <a href={signUpUrl} className="no-underline">
                <MatrixButton primary className="text-[10px] py-1">
                  REGISTER
                </MatrixButton>
              </a>
            </div>
          )}
        </header>

        {/* Content Router */}
        {isConnectPage ? (
          <AuthView defaultInsforgeBaseUrl={baseUrl} />
        ) : (
          <>
            {signedIn ? (
              <DashboardView
                auth={auth}
                logout={logout}
                vibeData={vibeData}
                installCmds={installCmds}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <MatrixPanel
                  title="ACCESS_DENIED"
                  className="max-w-md mx-auto text-center py-10 px-6"
                >
                  <div className="text-4xl mb-4 opacity-20 font-black">401</div>
                  <div className="text-sm font-bold tracking-widest mb-6">
                    AUTHENTICATION REQUIRED
                  </div>
                  <p className="opacity-60 text-xs mb-8">
                    You must interface with the identity provider to access this
                    dashboard.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <a href={signInUrl} className="no-underline">
                      <MatrixButton primary className="w-full">
                        LOGIN
                      </MatrixButton>
                    </a>
                    <a href={signUpUrl} className="no-underline">
                      <MatrixButton className="w-full">REGISTER</MatrixButton>
                    </a>
                  </div>
                </MatrixPanel>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="mt-auto pt-8 border-t border-[#00FF41]/10 flex justify-between opacity-30 text-[8px] uppercase font-black tracking-[0.3em]">
          <div className="flex space-x-6">
            <span>SYS_READY</span>
            <span>LATENCY: 12ms</span>
          </div>
          <div>© 2024 VIBESCORE CORP</div>
        </footer>
      </div>
    </div>
  );
}
