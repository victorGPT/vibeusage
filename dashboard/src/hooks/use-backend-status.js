import { useCallback, useEffect, useRef, useState } from "react";

import { probeBackend } from "../lib/vibescore-api.js";

export function useBackendStatus({
  baseUrl,
  accessToken,
  intervalMs = 60_000,
  timeoutMs = 2500,
  retryDelayMs = 300,
  failureThreshold = 2,
} = {}) {
  const [status, setStatus] = useState("unknown"); // unknown | active | error | down
  const [checking, setChecking] = useState(false);
  const [httpStatus, setHttpStatus] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [lastOkAt, setLastOkAt] = useState(null);
  const [error, setError] = useState(null);

  const inFlightRef = useRef(false);
  const failureCountRef = useRef(0);
  const threshold = Number.isFinite(Number(failureThreshold))
    ? Math.max(1, Math.floor(Number(failureThreshold)))
    : 2;

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setStatus("error");
      setChecking(false);
      setHttpStatus(null);
      setLastCheckedAt(new Date().toISOString());
      setError("Missing baseUrl");
      return;
    }

    try {
      new URL(baseUrl);
    } catch (_e) {
      setStatus("error");
      setChecking(false);
      setHttpStatus(null);
      setLastCheckedAt(new Date().toISOString());
      setError("Invalid baseUrl");
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    setError(null);

    try {
      const result = await probeWithRetry({
        baseUrl,
        accessToken,
        timeoutMs,
        retryDelayMs,
      });

      if (!result.ok) {
        throw result.error;
      }

      failureCountRef.current = 0;
      setHttpStatus(result.status ?? 200);
      const now = new Date().toISOString();
      setLastCheckedAt(now);
      setStatus("active");
      setError(null);
      setLastOkAt(now);
    } catch (e) {
      const statusCode = e?.status ?? e?.statusCode;
      setHttpStatus(Number.isFinite(statusCode) ? statusCode : null);
      setLastCheckedAt(new Date().toISOString());

      if (statusCode === 401 || statusCode === 403) {
        failureCountRef.current = 0;
        setStatus("error");
        setError("Unauthorized");
      } else if (typeof statusCode === "number" && statusCode < 500) {
        failureCountRef.current = 0;
        setStatus("error");
        setError(`HTTP ${statusCode}`);
      } else {
        failureCountRef.current += 1;
        const nextStatus = failureCountRef.current >= threshold ? "down" : "error";
        setStatus(nextStatus);
        setError(e?.name === "AbortError" ? "Timeout" : e?.message || "Fetch failed");
      }
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  }, [accessToken, baseUrl, retryDelayMs, threshold, timeoutMs]);

  useEffect(() => {
    let id = null;

    const stop = () => {
      if (id) window.clearInterval(id);
      id = null;
    };

    const start = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (id) return;
      refresh();
      id = window.setInterval(() => refresh(), intervalMs);
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.hidden) stop();
      else start();
    };

    start();
    document?.addEventListener?.("visibilitychange", onVisibility);
    return () => {
      stop();
      document?.removeEventListener?.("visibilitychange", onVisibility);
    };
  }, [intervalMs, refresh]);

  return {
    status,
    checking,
    httpStatus,
    lastCheckedAt,
    lastOkAt,
    error,
    refresh,
  };
}

async function probeWithRetry({ baseUrl, accessToken, timeoutMs, retryDelayMs }) {
  const first = await probeOnce({ baseUrl, accessToken, timeoutMs });
  if (first.ok) return first;
  if (!shouldRetry(first.error)) return first;
  if (retryDelayMs > 0) {
    await sleep(retryDelayMs);
  }
  return probeOnce({ baseUrl, accessToken, timeoutMs });
}

async function probeOnce({ baseUrl, accessToken, timeoutMs }) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await probeBackend({
      baseUrl,
      accessToken,
      signal: controller.signal,
    });
    return { ok: true, status: res?.status ?? 200 };
  } catch (error) {
    return { ok: false, error };
  } finally {
    window.clearTimeout(t);
  }
}

function shouldRetry(error) {
  if (!error) return false;
  if (error.retryable) return true;
  const statusCode = error?.status ?? error?.statusCode;
  if (statusCode >= 500) return true;
  return error?.name === "AbortError";
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
