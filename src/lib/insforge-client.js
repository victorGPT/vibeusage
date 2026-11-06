"use strict";

let sdkModulePromise = null;

async function loadInsforgeSdk() {
  if (!sdkModulePromise) {
    sdkModulePromise = import("@insforge/sdk").catch((err) => {
      sdkModulePromise = null;
      const wrapped = new Error("Missing dependency @insforge/sdk. Please reinstall vibeusage.");
      wrapped.cause = err;
      throw wrapped;
    });
  }
  return sdkModulePromise;
}

function getAnonKey({ env = process.env } = {}) {
  return env.VIBEUSAGE_INSFORGE_ANON_KEY || "";
}

function getHttpTimeoutMs({ env = process.env } = {}) {
  const raw = readEnvValue(env, ["VIBEUSAGE_HTTP_TIMEOUT_MS"]);
  if (raw == null || raw === "") return 20_000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20_000;
  if (n <= 0) return 0;
  return clampInt(n, 1000, 120_000);
}

function createTimeoutFetch(baseFetch) {
  if (!baseFetch) return baseFetch;
  return async (input, init = {}) => {
    const timeoutMs = getHttpTimeoutMs();
    if (!timeoutMs) return baseFetch(input, init);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
        timeoutErr.cause = err;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

async function createInsforgeClient({ baseUrl, accessToken } = {}) {
  if (!baseUrl) throw new Error("Missing baseUrl");
  const { createClient } = await loadInsforgeSdk();
  const anonKey = getAnonKey();
  return createClient({
    baseUrl,
    anonKey: anonKey || undefined,
    edgeFunctionToken: accessToken || undefined,
    // SDK 1.2.2 defaults to {appKey}.functions.insforge.app and only falls back on 404,
    // so a network-level block there fails every upload. Use the baseUrl gateway path.
    functionsUrl: `${String(baseUrl).replace(/\/+$/, "")}/functions`,
    fetch: createTimeoutFetch(globalThis.fetch),
  });
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function readEnvValue(env, keys) {
  if (!env || !Array.isArray(keys)) return undefined;
  for (const key of keys) {
    const value = env?.[key];
    if (value != null && value !== "") return value;
  }
  return undefined;
}

module.exports = {
  createInsforgeClient,
  getAnonKey,
  getHttpTimeoutMs,
};
