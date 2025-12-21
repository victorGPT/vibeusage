import React, { useMemo } from "react";

import { getInsforgeBaseUrl } from "./lib/config.js";
import { useAuth } from "./hooks/use-auth.js";
import { buildAuthUrl } from "./lib/auth-url.js";
import { ConnectCliPage } from "./pages/ConnectCliPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";

export default function App() {
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const { auth, signedIn, signOut } = useAuth();

  const routePath = useMemo(
    () => window.location.pathname.replace(/\/+$/, "") || "/",
    []
  );

  const redirectUrl = useMemo(
    () => `${window.location.origin}/auth/callback`,
    []
  );
  const signInUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-in", redirectUrl }),
    [baseUrl, redirectUrl]
  );

  if (routePath === "/connect") {
    return <ConnectCliPage defaultInsforgeBaseUrl={baseUrl} />;
  }

  if (!signedIn) {
    return <LandingPage signInUrl={signInUrl} />;
  }

  return (
    <DashboardPage
      baseUrl={baseUrl}
      auth={auth}
      signedIn={signedIn}
      signOut={signOut}
    />
  );
}
