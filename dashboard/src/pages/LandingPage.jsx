import React, { useEffect, useMemo, useState } from "react";
import { copy } from "../lib/copy";
import { safeWriteClipboard } from "../lib/safe-browser";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode";
import { LandingView } from "../ui/matrix-a/views/LandingView.jsx";
import { shouldDeferMount } from "./should-defer-mount.js";

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
}

function useDeferredMount(delayMs = 0, shouldDefer = true) {
  const [mounted, setMounted] = useState(() => !shouldDefer);

  useEffect(() => {
    if (!shouldDefer) {
      setMounted(true);
      return undefined;
    }
    let timer = null;
    let idleId = null;
    const run = () => setMounted(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: delayMs || 200 });
      return () => {
        if (typeof window.cancelIdleCallback === "function" && idleId != null) {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    timer = window.setTimeout(run, delayMs);
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [delayMs, shouldDefer]);

  return mounted;
}

export function LandingPage({ signInUrl, signUpUrl }) {
  const specialHandle = copy("landing.handle.special");
  const defaultHandle = copy("landing.handle.default");
  const loginLabel = copy("landing.nav.login");
  const signupLabel = copy("landing.nav.signup");
  const [handle, setHandle] = useState(defaultHandle);
  const reduceMotion = usePrefersReducedMotion();
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const deferMount = shouldDeferMount({
    prefersReducedMotion: reduceMotion,
    screenshotMode,
  });
  const effectsReady = useDeferredMount(250, deferMount);
  const installEntryKey = "vibeusage.dashboard.from_landing.v1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(installEntryKey, "1");
    } catch (_e) {
      // ignore write errors (private mode/quota)
    }
  }, [installEntryKey]);

  const handlePlaceholder = useMemo(
    () => copy("landing.handle.placeholder", { handle: specialHandle }),
    [specialHandle],
  );

  const rankLabel = useMemo(() => {
    const rank =
      handle === specialHandle ? copy("landing.rank.singularity") : copy("landing.rank.unranked");
    return copy("landing.rank.expectation", { rank });
  }, [handle, specialHandle]);

  const installCommand = copy("landing.install.command");
  const [installCopied, setInstallCopied] = useState(false);

  const handleChange = (event) => {
    setHandle(event.target.value.toUpperCase());
  };

  const handleCopyInstall = async () => {
    const didCopy = await safeWriteClipboard(installCommand);
    if (!didCopy) return;
    setInstallCopied(true);
    window.setTimeout(() => setInstallCopied(false), 2000);
  };

  return (
    <LandingView
      copy={copy}
      effectsReady={effectsReady}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      loginLabel={loginLabel}
      signupLabel={signupLabel}
      handle={handle}
      onHandleChange={handleChange}
      specialHandle={specialHandle}
      handlePlaceholder={handlePlaceholder}
      rankLabel={rankLabel}
      installCommand={installCommand}
      installCopied={installCopied}
      onCopyInstallCommand={handleCopyInstall}
    />
  );
}
