import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { getAppVersion } from "./lib/app-version";
import { getSafeSessionStorage, shouldRedirectFromAuthCallback } from "./lib/auth-callback";
import { resolveAuthGate } from "./lib/auth-gate";
import {
  buildRedirectUrl,
  consumePostAuthPath,
  resolveRedirectTarget,
  storeRedirectFromSearch,
  stripRedirectParam,
} from "./lib/auth-redirect";
import {
  clearAuthStorage,
  clearSessionExpired,
  clearSessionSoftExpired,
  loadSessionExpired,
  loadSessionSoftExpired,
  shouldClearSessionSoftExpiredForToken,
  subscribeSessionExpired,
  subscribeSessionSoftExpired,
} from "./lib/auth-storage";
import { getAccessTokenUserId, isLikelyExpiredAccessToken } from "./lib/auth-token";
import { getInsforgeBaseUrl } from "./lib/config";
import { resolveCurrentIdentity } from "./lib/current-identity";
import {
  getCurrentInsforgeSession,
  getInsforgeSessionSnapshot,
  insforgeAuthClient,
  subscribeInsforgeSession,
} from "./lib/insforge-auth-client";
import { clearInsforgePersistentStorage } from "./lib/insforge-client";
import { isMockEnabled } from "./lib/mock-data";
import { fetchLatestTrackerVersion } from "./lib/npm-version";
import { isScreenshotModeEnabled } from "./lib/screenshot-mode";
import { probeBackend } from "./lib/vibeusage-api";
import { LandingPage } from "./pages/LandingPage.jsx";
import { UpgradeAlertModal } from "./ui/matrix-a/components/UpgradeAlertModal.jsx";
import { VersionBadge } from "./ui/matrix-a/components/VersionBadge.jsx";

function buildAuthEntryUrl(basePath, nextPath) {
  if (typeof basePath !== "string" || basePath.length === 0) return "/";
  if (typeof nextPath !== "string" || nextPath.length === 0) return basePath;
  if (nextPath === "/") return basePath;
  const params = new URLSearchParams();
  params.set("next", nextPath);
  return `${basePath}?${params.toString()}`;
}

const DashboardPage = React.lazy(() =>
  import("./pages/DashboardPage.jsx").then((mod) => ({
    default: mod.DashboardPage,
  })),
);

const LeaderboardPage = React.lazy(() =>
  import("./pages/LeaderboardPage.jsx").then((mod) => ({
    default: mod.LeaderboardPage,
  })),
);

const LeaderboardProfilePage = React.lazy(() =>
  import("./pages/LeaderboardProfilePage.jsx").then((mod) => ({
    default: mod.LeaderboardProfilePage,
  })),
);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const mockEnabled = isMockEnabled();
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const appVersion = useMemo(() => getAppVersion(import.meta.env), []);
  const [latestVersion, setLatestVersion] = useState(null);
  const [insforgeLoaded, setInsforgeLoaded] = useState(false);
  const insforgeSession = useSyncExternalStore(
    subscribeInsforgeSession,
    getInsforgeSessionSnapshot,
    getInsforgeSessionSnapshot,
  );
  const [currentIdentity, setCurrentIdentity] = useState(undefined);
  const [sessionExpired, setSessionExpired] = useState(() => loadSessionExpired());
  const [sessionSoftExpired, setSessionSoftExpired] = useState(() => loadSessionSoftExpired());

  useEffect(() => {
    let active = true;
    fetchLatestTrackerVersion({ allowStale: true }).then((version) => {
      if (!active) return;
      setLatestVersion(version);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { saved } = storeRedirectFromSearch(window.location.search);
    if (!saved) return;
    const nextUrl = stripRedirectParam(window.location.href);
    if (!nextUrl || nextUrl === window.location.href) return;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    let active = true;
    setInsforgeLoaded(false);
    getCurrentInsforgeSession()
      .then((session) => {
        if (!active) return;
        setInsforgeLoaded(true);

        // Debug logging for mobile troubleshooting
        if (
          process.env.NODE_ENV === "development" ||
          window.location.search.includes("debug=1")
        ) {
          // eslint-disable-next-line no-console
          console.log("[Auth] Session refreshed:", {
            hasSession: Boolean(session?.accessToken),
            userId: session?.user?.id ?? null,
            timestamp: new Date().toISOString(),
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        setInsforgeLoaded(true);
        if (
          process.env.NODE_ENV === "development" ||
          window.location.search.includes("debug=1")
        ) {
          // eslint-disable-next-line no-console
          console.warn("[Auth] Session refresh failed:", err);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!insforgeLoaded) {
      setCurrentIdentity(undefined);
      return;
    }

    const sessionToken = insforgeSession?.accessToken ?? null;
    if (!sessionToken || isLikelyExpiredAccessToken(sessionToken)) {
      setCurrentIdentity(null);
      return;
    }

    let active = true;
    setCurrentIdentity(undefined);
    resolveCurrentIdentity(insforgeSession)
      .then((identity) => {
        if (!active) return;
        setCurrentIdentity(identity);
      })
      .catch(() => {
        if (!active) return;
        setCurrentIdentity(null);
      });

    return () => {
      active = false;
    };
  }, [insforgeLoaded, insforgeSession]);

  useEffect(() => {
    return subscribeSessionExpired((next) => {
      setSessionExpired(Boolean(next));
    });
  }, []);

  useEffect(() => {
    return subscribeSessionSoftExpired((next) => {
      setSessionSoftExpired(Boolean(next));
    });
  }, []);

  useEffect(() => {
    if (!insforgeLoaded) return;
    if (insforgeSession?.accessToken && !isLikelyExpiredAccessToken(insforgeSession.accessToken)) {
      return;
    }
    if (!sessionSoftExpired) return;
    // Avoid getting stuck on dashboard without a usable session token.
    clearSessionSoftExpired();
  }, [insforgeLoaded, insforgeSession, sessionSoftExpired]);

  const getInsforgeAccessToken = useCallback(async () => {
    const fallbackToken = !isLikelyExpiredAccessToken(insforgeSession?.accessToken)
      ? (insforgeSession?.accessToken ?? null)
      : null;
    if (fallbackToken) {
      return fallbackToken;
    }
    const session = await getCurrentInsforgeSession();
    const sessionToken = session?.accessToken ?? null;
    if (!isLikelyExpiredAccessToken(sessionToken)) {
      return sessionToken;
    }
    return null;
  }, [insforgeSession]);

  useEffect(() => {
    if (!sessionSoftExpired) return () => {};
    if (!insforgeLoaded) return () => {};
    if (!insforgeSession?.accessToken) return () => {};
    let active = true;
    const revalidate = async () => {
      if (!active) return;
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      try {
        const session = await getCurrentInsforgeSession();
        if (!active) return;
        const nextToken = session?.accessToken ?? null;
        if (shouldClearSessionSoftExpiredForToken(nextToken)) {
          clearSessionSoftExpired();
          return;
        }
        if (!nextToken || isLikelyExpiredAccessToken(nextToken)) {
          return;
        }
        try {
          await probeBackend({ baseUrl, accessToken: nextToken });
          if (!active) return;
          clearSessionSoftExpired();
        } catch (_probeError) {
          // Keep the soft-expired guard until the same token can pass a protected probe.
        }
      } catch (_e) {
        // ignore refresh errors
      }
    };
    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "visible") {
        revalidate();
      }
    };
    const onFocus = () => {
      revalidate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    revalidate();
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [baseUrl, insforgeLoaded, insforgeSession?.accessToken, sessionSoftExpired]);

  const insforgeAuth = useMemo(() => {
    const sessionToken = insforgeSession?.accessToken ?? null;
    if (!sessionToken || isLikelyExpiredAccessToken(sessionToken)) return null;
    const user = insforgeSession.user;
    const userId = user?.id ?? getAccessTokenUserId(sessionToken);
    return {
      accessToken: sessionToken,
      getAccessToken: getInsforgeAccessToken,
      userId,
      email: user?.email ?? null,
      savedAt: new Date().toISOString(),
    };
  }, [getInsforgeAccessToken, insforgeSession]);

  const redirectOnceRef = useRef(false);
  useEffect(() => {
    if (redirectOnceRef.current) return;
    const sessionToken = insforgeSession?.accessToken ?? null;
    if (!sessionToken || isLikelyExpiredAccessToken(sessionToken) || sessionExpired) {
      return;
    }
    const target = resolveRedirectTarget(window.location.search);
    if (target) {
      const user = insforgeSession.user;
      const userId = user?.id ?? getAccessTokenUserId(sessionToken);
      redirectOnceRef.current = true;
      const redirectUrl = buildRedirectUrl(target, {
        accessToken: sessionToken,
        userId,
        email: user?.email ?? null,
      });
      window.location.assign(redirectUrl);
      return;
    }

    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath !== "/auth/callback") return;

    const nextPath = consumePostAuthPath();
    const destination = nextPath && nextPath !== "/auth/callback" ? nextPath : "/";
    redirectOnceRef.current = true;
    navigate(destination, { replace: true });
  }, [insforgeSession, navigate, sessionExpired]);

  const hasInsforgeSession = Boolean(
    insforgeSession?.accessToken && !isLikelyExpiredAccessToken(insforgeSession.accessToken),
  );
  // Data API calls only require access token. User profile fields can be absent on
  // some mobile restore paths, so don't block signed-in state on `session.user`.
  const signedIn = hasInsforgeSession;
  const auth = useMemo(() => {
    if (!hasInsforgeSession) return null;
    return insforgeAuth;
  }, [hasInsforgeSession, insforgeAuth]);

  useEffect(() => {
    if (!insforgeLoaded) return;
    if (hasInsforgeSession) return;
    clearInsforgePersistentStorage();
    clearAuthStorage();
    clearSessionExpired();
    clearSessionSoftExpired();
  }, [hasInsforgeSession, insforgeLoaded]);

  const signOut = useMemo(() => {
    return async () => {
      try {
        await insforgeAuthClient.auth.signOut();
      } finally {
        clearInsforgePersistentStorage();
        clearAuthStorage();
        clearSessionExpired();
        clearSessionSoftExpired();
      }
    };
  }, []);

  const pathname = location?.pathname || "/";
  const pageUrl = new URL(window.location.href);
  const sharePathname = pageUrl.pathname.replace(/\/+$/, "") || "/";
  const shareMatch = sharePathname.match(/^\/share\/([^/?#]+)$/i);
  const tokenFromPath = shareMatch?.[1] || null;
  const tokenFromQuery = pageUrl.searchParams.get("token") || null;
  const publicToken = tokenFromPath || tokenFromQuery;
  const publicMode =
    sharePathname === "/share" ||
    sharePathname === "/share.html" ||
    sharePathname.startsWith("/share/");
  const postAuthNext = useMemo(() => {
    if (typeof window === "undefined") return null;
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === "/auth/callback") return null;
    const search = location?.search || "";
    const hash = location?.hash || "";
    const url = new URL(`${normalizedPath}${search}${hash}`, window.location.origin);
    // CLI uses these to pass a loopback callback to complete auth. They are not SPA paths.
    url.searchParams.delete("redirect");
    url.searchParams.delete("base_url");
    const candidate = `${url.pathname}${url.search}${url.hash}`;
    return candidate === "/" ? null : candidate;
  }, [location?.hash, location?.search, pathname]);
  const signInUrl = useMemo(() => buildAuthEntryUrl("/sign-in", postAuthNext), [postAuthNext]);
  const signUpUrl = useMemo(() => buildAuthEntryUrl("/sign-up", postAuthNext), [postAuthNext]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!insforgeLoaded) return;
    const shouldRedirect = shouldRedirectFromAuthCallback({
      pathname: window.location.pathname,
      search: window.location.search,
      hasSession: Boolean(insforgeSession?.accessToken),
      sessionResolved: insforgeSession !== undefined,
      storage: getSafeSessionStorage(),
    });
    if (!shouldRedirect) return;
    navigate(signInUrl, { replace: true });
  }, [insforgeLoaded, insforgeSession, navigate, signInUrl]);

  const loadingShell = <div className="min-h-screen bg-surface" />;
  const authPending =
    !publicMode &&
    !mockEnabled &&
    !sessionSoftExpired &&
    (!insforgeLoaded || insforgeSession === undefined);
  const gate = resolveAuthGate({
    publicMode,
    mockEnabled,
    sessionSoftExpired,
    signedIn,
    authPending,
  });
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const leaderboardProfileMatch = normalizedPath.match(/^\/leaderboard\/u\/([^/]+)$/i);
  const leaderboardProfileUserId = leaderboardProfileMatch ? leaderboardProfileMatch[1] : null;
  const PageComponent = leaderboardProfileUserId
    ? LeaderboardProfilePage
    : normalizedPath === "/leaderboard"
      ? LeaderboardPage
      : DashboardPage;
  let content = null;
  if (gate === "loading") {
    content = loadingShell;
  } else if (gate === "landing") {
    content = <LandingPage signInUrl={signInUrl} signUpUrl={signUpUrl} />;
  } else {
    content = (
      <Suspense fallback={loadingShell}>
        {!publicMode && !screenshotMode ? (
          <UpgradeAlertModal requiredVersion={latestVersion} />
        ) : null}
        <PageComponent
          baseUrl={baseUrl}
          auth={auth}
          currentIdentity={currentIdentity}
          signedIn={signedIn}
          sessionSoftExpired={sessionSoftExpired}
          signOut={signOut}
          publicMode={publicMode}
          publicToken={publicToken}
          userId={leaderboardProfileUserId}
          signInUrl={signInUrl}
          signUpUrl={signUpUrl}
        />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary>
      {content}
      {!screenshotMode ? <VersionBadge version={appVersion} /> : null}
    </ErrorBoundary>
  );
}
