import { useCallback, useEffect, useState } from "react";

import { getUsageDaily, getUsageSummary } from "../lib/vibescore-api.js";
import { formatDateUTC } from "../lib/date-range.js";
import { isMockEnabled } from "../lib/mock-data.js";

export function useUsageData({
  baseUrl,
  accessToken,
  from,
  to,
  includeDaily = true,
  cacheKey,
} = {}) {
  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
  const [source, setSource] = useState("edge");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mockEnabled = isMockEnabled();

  const storageKey = (() => {
    if (!cacheKey) return null;
    const host = safeHost(baseUrl) || "default";
    const dailyKey = includeDaily ? "daily" : "summary";
    return `vibescore.usage.${cacheKey}.${host}.${from}.${to}.${dailyKey}`;
  })();

  const readCache = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.summary) return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }, [storageKey]);

  const writeCache = useCallback(
    (payload) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (_e) {
        // ignore write errors (quota/private mode)
      }
    },
    [storageKey]
  );

  const refresh = useCallback(async () => {
    if (!accessToken && !mockEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const promises = [getUsageSummary({ baseUrl, accessToken, from, to })];
      if (includeDaily) {
        promises.unshift(getUsageDaily({ baseUrl, accessToken, from, to }));
      }

      const results = await Promise.all(promises);
      const summaryRes = includeDaily ? results[1] : results[0];
      const dailyRes = includeDaily ? results[0] : null;

      let nextDaily =
        includeDaily && Array.isArray(dailyRes?.data) ? dailyRes.data : [];
      if (includeDaily) {
        nextDaily = fillDailyGaps(nextDaily, from, to);
      }
      const nextSummary = summaryRes?.totals || null;
      const nowIso = new Date().toISOString();

      setDaily(nextDaily);
      setSummary(nextSummary);
      setSource("edge");
      setFetchedAt(nowIso);

      if (nextSummary) {
        writeCache({
          summary: nextSummary,
          daily: nextDaily,
          from,
          to,
          includeDaily,
          fetchedAt: nowIso,
        });
      }
    } catch (e) {
      const cached = readCache();
      if (cached?.summary) {
        setSummary(cached.summary);
        const cachedDaily = Array.isArray(cached.daily) ? cached.daily : [];
        const filledDaily = includeDaily
          ? fillDailyGaps(cachedDaily, cached.from || from, cached.to || to)
          : cachedDaily;
        setDaily(filledDaily);
        setSource("cache");
        setFetchedAt(cached.fetchedAt || null);
        setError(null);
      } else {
        setError(e?.message || String(e));
        setDaily([]);
        setSummary(null);
        setSource("edge");
        setFetchedAt(null);
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    baseUrl,
    from,
    includeDaily,
    mockEnabled,
    readCache,
    to,
    writeCache,
  ]);

  useEffect(() => {
    if (!accessToken && !mockEnabled) {
      setDaily([]);
      setSummary(null);
      setError(null);
      setLoading(false);
      setSource("edge");
      setFetchedAt(null);
      return;
    }
    const cached = readCache();
    if (cached?.summary) {
      setSummary(cached.summary);
      const cachedDaily = Array.isArray(cached.daily) ? cached.daily : [];
      const filledDaily = includeDaily
        ? fillDailyGaps(cachedDaily, cached.from || from, cached.to || to)
        : cachedDaily;
      setDaily(filledDaily);
      setSource("cache");
      setFetchedAt(cached.fetchedAt || null);
    }
    refresh();
  }, [accessToken, mockEnabled, readCache, refresh]);

  const normalizedSource = mockEnabled ? "mock" : source;

  return {
    daily,
    summary,
    source: normalizedSource,
    fetchedAt,
    loading,
    error,
    refresh,
  };
}

function safeHost(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch (_e) {
    return null;
  }
}

function parseUtcDate(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const raw = String(yyyyMmDd).trim();
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(Date.UTC(y, m, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return formatDateUTC(dt) === raw ? dt : null;
}

function addUtcDays(date, days) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function fillDailyGaps(rows, from, to) {
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  if (!start || !end || end < start) return Array.isArray(rows) ? rows : [];

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayTime = today.getTime();

  const byDay = new Map();
  for (const row of rows || []) {
    if (row?.day) byDay.set(row.day, row);
  }

  const filled = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const day = formatDateUTC(cursor);
    const existing = byDay.get(day);
    if (existing) {
      filled.push({ ...existing, missing: false, future: false });
      continue;
    }
    const isFuture = cursor.getTime() > todayTime;
    filled.push({
      day,
      total_tokens: null,
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      reasoning_output_tokens: null,
      missing: !isFuture,
      future: isFuture,
    });
  }

  return filled;
}
