import React, { useMemo } from "react";

import { getInsforgeBaseUrl } from "./lib/config.js";
import { useAuth } from "./hooks/use-auth.js";
import { ConnectCliPage } from "./pages/ConnectCliPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";

export default function App() {
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const { auth, signedIn, signOut } = useAuth();

  const routePath = useMemo(
    () => window.location.pathname.replace(/\/+$/, "") || "/",
    []
  );
  if (routePath === "/connect") {
    return <ConnectCliPage defaultInsforgeBaseUrl={baseUrl} />;
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
