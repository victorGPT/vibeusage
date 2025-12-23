import React, { Suspense, useMemo } from "react";

import { getInsforgeBaseUrl } from "./lib/config.js";
import { useAuth } from "./hooks/use-auth.js";
import { buildAuthUrl } from "./lib/auth-url.js";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { isMockEnabled } from "./lib/mock-data.js";

const DashboardPage = React.lazy(() =>
  import("./pages/DashboardPage.jsx").then((mod) => ({
    default: mod.DashboardPage,
  }))
);

const LOCAL_REDIRECT_HOSTS = new Set(["127.0.0.1", "localhost"]);

function getSafeRedirect(searchParams) {
  const redirect = searchParams.get("redirect") || "";
  if (!redirect) return null;

  try {
    const redirectUrl = new URL(redirect);
    if (redirectUrl.protocol !== "http:") return null;
    if (!LOCAL_REDIRECT_HOSTS.has(redirectUrl.hostname)) return null;
    return redirectUrl.toString();
  } catch (_e) {
    return null;
  }
}

export default function App() {
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const { auth, signedIn, signOut } = useAuth();
  const mockEnabled = isMockEnabled();

  const pageUrl = new URL(window.location.href);
  const safeRedirect = getSafeRedirect(pageUrl.searchParams);
  const baseUrlOverride =
    safeRedirect && pageUrl.searchParams.get("base_url")
      ? pageUrl.searchParams.get("base_url")
      : "";
  const authBaseUrl = baseUrlOverride || baseUrl;

  const defaultRedirectUrl = useMemo(
    () => `${window.location.origin}/auth/callback`,
    []
  );
  const signInUrl = useMemo(
    () =>
      buildAuthUrl({
        baseUrl: authBaseUrl,
        path: "/auth/sign-in",
        redirectUrl: safeRedirect || defaultRedirectUrl,
      }),
    [authBaseUrl, defaultRedirectUrl, safeRedirect]
  );

  const loadingShell = <div className="min-h-screen bg-[#050505]" />;
  let content = null;
  const accessEnabled = signedIn || mockEnabled;
  if (!accessEnabled) {
    content = <LandingPage signInUrl={signInUrl} />;
  } else {
    content = (
      <Suspense fallback={loadingShell}>
        <DashboardPage
          baseUrl={baseUrl}
          auth={auth}
          signedIn={signedIn}
          signOut={signOut}
        />
      </Suspense>
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
