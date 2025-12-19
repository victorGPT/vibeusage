import { fetchJson } from "./http.js";
import {
  getMockUsageDaily,
  getMockUsageHeatmap,
  getMockUsageSummary,
  isMockEnabled,
} from "./mock-data.js";

const PATHS = {
  usageSummary: "/functions/vibescore-usage-summary",
  usageDaily: "/functions/vibescore-usage-daily",
  usageHeatmap: "/functions/vibescore-usage-heatmap",
};

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function makeUrl(baseUrl, path) {
  return new URL(path, baseUrl);
}

export function getBackendProbeUrl(baseUrl) {
  return makeUrl(baseUrl, PATHS.usageSummary).toString();
}

export async function getUsageSummary({ baseUrl, accessToken, from, to }) {
  if (isMockEnabled()) {
    return getMockUsageSummary({ from, to, seed: accessToken });
  }
  const url = makeUrl(baseUrl, PATHS.usageSummary);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  return fetchJson(url.toString(), { headers: authHeaders(accessToken) });
}

export async function getUsageDaily({ baseUrl, accessToken, from, to }) {
  if (isMockEnabled()) {
    return getMockUsageDaily({ from, to, seed: accessToken });
  }
  const url = makeUrl(baseUrl, PATHS.usageDaily);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  return fetchJson(url.toString(), { headers: authHeaders(accessToken) });
}

export async function getUsageHeatmap({
  baseUrl,
  accessToken,
  weeks,
  to,
  weekStartsOn,
}) {
  if (isMockEnabled()) {
    return getMockUsageHeatmap({
      weeks,
      to,
      weekStartsOn,
      seed: accessToken,
    });
  }
  const url = makeUrl(baseUrl, PATHS.usageHeatmap);
  url.searchParams.set("weeks", String(weeks));
  url.searchParams.set("to", to);
  url.searchParams.set("week_starts_on", weekStartsOn);
  return fetchJson(url.toString(), { headers: authHeaders(accessToken) });
}
