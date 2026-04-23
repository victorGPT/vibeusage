import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  storePostAuthPathFromSearch,
  storeRedirectFromSearch,
  stripNextParam,
  stripRedirectParam,
} from "../lib/auth-redirect";
import { startGithubOAuthRedirect } from "../lib/oauth-redirect-init";

function buildCallbackUrl() {
  if (typeof window === "undefined") return "/auth/callback";
  return `${window.location.origin}/auth/callback`;
}

export function SignUpRedirect() {
  const callbackUrl = useMemo(() => buildCallbackUrl(), []);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { saved } = storeRedirectFromSearch(window.location.search);
    const { saved: nextSaved } = storePostAuthPathFromSearch(window.location.search);
    if (!saved && !nextSaved) return;

    let nextUrl = window.location.href;
    const strippedRedirect = stripRedirectParam(nextUrl);
    if (strippedRedirect) nextUrl = strippedRedirect;
    const strippedNext = stripNextParam(nextUrl);
    if (strippedNext) nextUrl = strippedNext;
    if (!nextUrl || nextUrl === window.location.href) return;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const run = async () => {
      try {
        await startGithubOAuthRedirect({ callbackUrl });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Sign-up redirect failed:", error);
        navigate("/", { replace: true });
      }
    };

    run();
  }, [callbackUrl, navigate]);

  return <div className="min-h-screen bg-surface" />;
}
