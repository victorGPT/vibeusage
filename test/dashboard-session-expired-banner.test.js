const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadDashboardModule } = require("./helpers/load-dashboard-module");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

test("auth storage exposes session soft expired helpers", () => {
  const src = read("dashboard/src/lib/auth-storage.ts");
  assert.match(src, /SESSION_SOFT_EXPIRED_KEY/);
  assert.match(src, /loadSessionSoftExpired/);
  assert.match(src, /setSessionSoftExpired/);
  assert.match(src, /clearSessionSoftExpired/);
  assert.match(src, /markSessionSoftExpired/);
  assert.match(src, /subscribeAuthStorage/);
  assert.match(src, /subscribeSessionSoftExpired/);
  assert.doesNotMatch(src, /loadAuthFromStorage/);
  assert.doesNotMatch(src, /saveAuthToStorage/);
});

test("App does not use legacy auth hook", () => {
  const src = read("dashboard/src/App.jsx");
  assert.doesNotMatch(src, /useLegacyAuth/);
});

test("main avoids InsForge react-router provider restore", () => {
  const src = read("dashboard/src/main.jsx");
  assert.doesNotMatch(src, /@insforge\/react-router/);
  assert.doesNotMatch(src, /InsforgeProvider/);
  assert.doesNotMatch(src, /getInsforgeRoutes/);
  assert.match(src, /createBrowserRouter/);
  assert.match(src, /RouterProvider/);
});

test("insforge auth client wrapper uses base url and anon key", () => {
  const wrapper = read("dashboard/src/lib/insforge-auth-client.ts");
  assert.match(wrapper, /createInsforgeAuthClient/);

  const src = read("dashboard/src/lib/insforge-client.ts");
  assert.match(src, /createInsforgeAuthClient/);
  assert.match(src, /getInsforgeBaseUrl/);
  assert.match(src, /getInsforgeAnonKey/);
});

test("App uses hosted auth routes for Landing login", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /\"\/sign-in\"/);
  assert.match(src, /\"\/sign-up\"/);
});

test("App passes hosted auth routes to page component", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /signInUrl=\{signInUrl\}/);
  assert.match(src, /signUpUrl=\{signUpUrl\}/);
});

test("App routes LandingPage when signed out", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /resolveAuthGate/);
  assert.match(src, /gate\s*===\s*["']landing["']/);
});

test("App uses repo-owned hosted auth state for signed-in gating", () => {
  const src = read("dashboard/src/App.jsx");
  assert.doesNotMatch(src, /@insforge\/react-router/);
  assert.doesNotMatch(src, /useInsforgeAuth/);
  assert.match(src, /useSyncExternalStore/);
  assert.match(src, /subscribeInsforgeSession/);
  assert.match(src, /getInsforgeSessionSnapshot/);
  assert.match(src, /insforgeAuthClient\.auth\.signOut\(\)/);
});

test("App derives signedIn from InsForge session state", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /const signedIn\s*=\s*hasInsforgeSession/);
  assert.doesNotMatch(src, /hasInsforgeIdentity/);
});

test("App keeps auth while session is soft-expired", () => {
  const src = read("dashboard/src/App.jsx");
  assert.doesNotMatch(src, /sessionSoftExpired[^;]*return\s+null/);
});

test("App provides InsForge access token resolver", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /getCurrentInsforgeSession/);
  assert.match(src, /getAccessToken/);
});

test("App resolves current identity from backend profile", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /resolveCurrentIdentity/);
  assert.match(src, /currentIdentity/);
  assert.doesNotMatch(src, /name:\s*displayName/);
  assert.doesNotMatch(src, /profile\?\.name/);
  assert.doesNotMatch(src, /user\?\.name/);
});

test("App subscribes to sessionSoftExpired state", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /loadSessionSoftExpired/);
  assert.match(src, /subscribeSessionSoftExpired/);
});

test("App declares getInsforgeAccessToken before revalidate effect", () => {
  const src = read("dashboard/src/App.jsx");
  const tokenIndex = src.indexOf("const getInsforgeAccessToken");
  const authMemoIndex = src.indexOf("const auth = useMemo");
  assert.ok(tokenIndex !== -1, "expected getInsforgeAccessToken declaration");
  assert.ok(authMemoIndex !== -1, "expected auth memo");
  assert.ok(tokenIndex < authMemoIndex);
});

test("App does not require InsForge identity before signedIn", () => {
  const src = read("dashboard/src/App.jsx");
  assert.doesNotMatch(src, /const hasInsforgeIdentity/);
  assert.match(src, /const hasInsforgeSession/);
  assert.match(src, /don't block signed-in state on `session\.user`/);
});

test("App does not use legacy safe redirects", () => {
  const src = read("dashboard/src/App.jsx");
  assert.doesNotMatch(src, /buildAuthUrl/);
  assert.doesNotMatch(src, /getSafeRedirect/);
  assert.doesNotMatch(src, /LOCAL_REDIRECT_HOSTS/);
});

test("App registers visibility revalidate for soft-expired sessions", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /visibilitychange/);
  assert.match(src, /sessionSoftExpired/);
  assert.match(src, /getCurrentInsforgeSession/);
});

test("App probes backend to clear same-token soft-expired sessions", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /probeBackend/);
  assert.match(src, /const nextToken = session\?\.accessToken \?\? null;/);
  assert.match(src, /if \(shouldClearSessionSoftExpiredForToken\(nextToken\)\) \{/);
  assert.match(src, /if \(!nextToken \|\| isLikelyExpiredAccessToken\(nextToken\)\) \{/);
  assert.match(src, /await probeBackend\(\{ baseUrl, accessToken: nextToken \}\)/);
});

test("vibeusage-api resolves access token providers", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  const authTokenSrc = read("dashboard/src/lib/auth-token.js");
  assert.match(src, /resolveAccessToken/);
  assert.match(src, /resolveAuthAccessToken/);
  assert.match(authTokenSrc, /typeof\s+auth\s*===\s*\"function\"/);
});

test("App avoids legacy auth fallback before InsForge is ready", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /const authPending[\s\S]*!insforgeLoaded \|\| insforgeSession === undefined/);
});

test("App clears stale InsForge storage after hosted auth resolves signed out", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /if \(!insforgeLoaded\) return;/);
  assert.match(src, /if \(hasInsforgeSession\) return;/);
  assert.match(src, /if \(sessionSoftExpired\) return;/);
  assert.match(src, /clearInsforgePersistentStorage\(\)/);
  assert.match(src, /clearAuthStorage\(\)/);
  assert.match(src, /clearSessionExpired\(\)/);
  assert.match(src, /clearSessionSoftExpired\(\)/);
});

test("DashboardPage shows the session expired screen with a sign-in action", () => {
  const pageSrc = read("dashboard/src/pages/DashboardPage.jsx");
  assert.match(pageSrc, /if \(showExpiredGate\) return "expired";/);
  assert.match(pageSrc, /<StateScreen[\s\S]*?onSignIn=\{handleSignIn\}/);
});

test("DashboardPage disables auth access token when session expired", () => {
  const src = read("dashboard/src/pages/DashboardPage.jsx");
  assert.match(src, /const authTokenAllowed\s*=\s*signedIn\s*&&\s*!sessionSoftExpired/);
  assert.match(src, /const authAccessToken\s*=\s*useMemo/);
  assert.match(src, /if\s*\(!authTokenAllowed\)\s*return\s+null/);
});

test("DashboardPage enables guest data flow when session soft expired", () => {
  const src = read("dashboard/src/pages/DashboardPage.jsx");
  assert.match(src, /const guestAllowed\s*=\s*signedIn\s*&&\s*sessionSoftExpired/);
  assert.match(src, /useUsageData\([\s\S]*guestAllowed/);
  assert.match(src, /useProjectUsageSummary\([\s\S]*guestAllowed/);
  assert.match(src, /useUsageModelBreakdown\([\s\S]*guestAllowed/);
  assert.match(src, /useTrendData\([\s\S]*guestAllowed/);
  assert.match(src, /useActivityHeatmap\([\s\S]*guestAllowed/);
});

test("Usage hooks resolve auth tokens per request and allow guest flow", () => {
  const usageSrc = read("dashboard/src/hooks/use-usage-data.ts");
  const projectUsageSrc = read("dashboard/src/hooks/use-project-usage-summary.ts");
  const trendSrc = read("dashboard/src/hooks/use-trend-data.ts");
  const heatmapSrc = read("dashboard/src/hooks/use-activity-heatmap.ts");
  const breakdownSrc = read("dashboard/src/hooks/use-usage-model-breakdown.ts");
  assert.match(usageSrc, /resolveAuthAccessToken/);
  assert.match(projectUsageSrc, /resolveAuthAccessToken/);
  assert.match(trendSrc, /resolveAuthAccessToken/);
  assert.match(heatmapSrc, /resolveAuthAccessToken/);
  assert.match(breakdownSrc, /resolveAuthAccessToken/);
  assert.match(usageSrc, /guestAllowed/);
  assert.match(projectUsageSrc, /guestAllowed/);
  assert.match(trendSrc, /guestAllowed/);
  assert.match(heatmapSrc, /guestAllowed/);
  assert.match(breakdownSrc, /guestAllowed/);
});

function assertGuestCacheGuard(src) {
  assert.match(src, /const\s+cacheAllowed\s*=\s*!guestAllowed/);
  assert.match(src, /if\s*\(cacheAllowed\)[\s\S]*?readCache\(/);
}

test("Usage hooks skip cached data in guest mode", () => {
  const usageSrc = read("dashboard/src/hooks/use-usage-data.ts");
  const trendSrc = read("dashboard/src/hooks/use-trend-data.ts");
  const heatmapSrc = read("dashboard/src/hooks/use-activity-heatmap.ts");
  const breakdownSrc = read("dashboard/src/hooks/use-usage-model-breakdown.ts");

  assertGuestCacheGuard(usageSrc);
  assertGuestCacheGuard(trendSrc);
  assertGuestCacheGuard(heatmapSrc);
  assertGuestCacheGuard(breakdownSrc);
});

test("DashboardPage uses hosted auth routes", () => {
  const src = read("dashboard/src/pages/DashboardPage.jsx");
  assert.doesNotMatch(src, /buildAuthUrl/);
  assert.ok(!src.includes("/auth/callback"));
});

test("vibeusage-api marks session soft expired only for jwt access tokens", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  assert.match(src, /markSessionSoftExpired/);
  assert.match(src, /isJwtAccessToken/);
  const markMatch = src.match(/function shouldMarkSessionSoftExpired\([\s\S]*?\)\s*\{[\s\S]*?\n\}/);
  assert.ok(markMatch, "expected shouldMarkSessionSoftExpired helper");
  assert.match(markMatch[0], /isSessionAuthFailure/);
  assert.match(markMatch[0], /canSetSessionSoftExpired/);
  const guardMatch = src.match(/function canSetSessionSoftExpired\([\s\S]*?\)\s*\{[\s\S]*?\n\}/);
  assert.ok(guardMatch, "expected canSetSessionSoftExpired helper");
  assert.match(guardMatch[0], /hasAccessTokenValue/);
  assert.match(guardMatch[0], /isJwtAccessToken\(/);
});

test("vibeusage-api clears session soft expired after successful jwt responses", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  assert.match(src, /clearSessionSoftExpired/);
  const match = src.match(/function shouldClearSessionSoftExpired\([\s\S]*?\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, "expected shouldClearSessionSoftExpired helper");
  assert.match(match[0], /canSetSessionSoftExpired/);
});

test("vibeusage-api retries after refresh retry errors", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  assert.doesNotMatch(src, /throw\s+normalizeSdkError\(\s*retryErr/);
});

test("vibeusage-api reuses refreshed http client for retries", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  const matches = src.match(/http\s*=\s*retryHttp/g) ?? [];
  assert.strictEqual(matches.length, 2);
});

test("vibeusage-api only marks soft expired after refresh when token missing", () => {
  const src = read("dashboard/src/lib/vibeusage-api.ts");
  assert.match(
    src,
    /if\s*\(\s*hasAccessTokenValue\(refreshedToken\)\s*\)[\s\S]*?\}\s*else if\s*\([\s\S]*canSetSessionSoftExpired[\s\S]*\)[\s\S]*markSessionSoftExpired/,
  );
});

test("copy registry includes session expired strings", () => {
  const src = read("dashboard/src/content/copy.csv");
  assert.ok(src.includes("dashboard.session_expired.title"));
  assert.ok(src.includes("dashboard.session_expired.subtitle"));
  assert.ok(src.includes("dashboard.session_expired.body"));
  assert.ok(src.includes("dashboard.session_expired.body_tail"));
  assert.ok(src.includes("dashboard.session_expired.copy_label"));
  assert.ok(src.includes("dashboard.session_expired.copied"));
});

test("auth storage skips localStorage when window is undefined", async () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");

  let setItemCalls = 0;
  globalThis.localStorage = {
    getItem() {
      throw new Error("unexpected localStorage access");
    },
    setItem() {
      setItemCalls += 1;
      throw new Error("unexpected localStorage access");
    },
    removeItem() {
      throw new Error("unexpected localStorage access");
    },
  };

  if (hadWindow) delete globalThis.window;

  const { setSessionSoftExpired } = await loadDashboardModule("dashboard/src/lib/auth-storage.ts");

  assert.doesNotThrow(() => {
    setSessionSoftExpired();
  });
  assert.equal(setItemCalls, 0);

  if (hadWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
  globalThis.localStorage = originalLocalStorage;
});

test("DashboardPage gates expired UI", () => {
  const pageSrc = read("dashboard/src/pages/DashboardPage.jsx");
  assert.match(pageSrc, /const showExpiredGate\s*=\s*sessionSoftExpired\s*&&\s*!publicMode/);
  assert.match(pageSrc, /mainScreen\(\{[\s\S]*?showExpiredGate,/);
});

test("App clears soft-expired state after a different token or successful same-token probe", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /shouldClearSessionSoftExpiredForToken\(nextToken\)/);
  assert.match(src, /await probeBackend\(\{ baseUrl, accessToken: nextToken \}\)/);
});

test("App preserves soft-expired state when an expired restored token can still retry", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /if \(insforgeSession\?\.accessToken\) return;/);
  assert.match(src, /if \(sessionSoftExpired\) return;/);
});
