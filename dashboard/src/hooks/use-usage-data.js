import { useCallback, useEffect, useState } from "react";

import { getUsageDaily, getUsageSummary } from "../lib/vibescore-api.js";
import { formatDateLocal, formatDateUTC } from "../lib/date-range.js";
import { isMockEnabled } from "../lib/mock-data.js";
import { getLocalDayKey, getTimeZoneCacheKey } from "../lib/timezone.js";

export function useUsageData({
  baseUrl,
  accessToken,
  from,
  to,
  includeDaily = true,
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
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
    const tzKey = getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes });
    return `vibeusage.usage.${cacheKey}.${host}.${from}.${to}.${dailyKey}.${tzKey}`;
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
      let dailyRes = null;
      let summaryRes = null;
      if (includeDaily) {
        dailyRes = await getUsageDaily({ baseUrl, accessToken, from, to, timeZone, tzOffsetMinutes });
      } else {
        summaryRes = await getUsageSummary({ baseUrl, accessToken, from, to, timeZone, tzOffsetMinutes });
      }

      let nextDaily =
        includeDaily && Array.isArray(dailyRes?.data) ? dailyRes.data : [];
      if (includeDaily) {
        nextDaily = fillDailyGaps(nextDaily, from, to, {
          timeZone,
          offsetMinutes: tzOffsetMinutes,
          now,
        });
      }
      let nextSummary = summaryRes?.totals || dailyRes?.summary?.totals || null;
      if (includeDaily && !nextSummary) {
        const fallback = await getUsageSummary({
          baseUrl,
          accessToken,
          from,
          to,
          timeZone,
          tzOffsetMinutes
        });
        nextSummary = fallback?.totals || null;
      }
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
          ? fillDailyGaps(cachedDaily, cached.from || from, cached.to || to, {
              timeZone,
              offsetMinutes: tzOffsetMinutes,
              now,
            })
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
    now,
    readCache,
    timeZone,
    to,
    tzOffsetMinutes,
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
        ? fillDailyGaps(cachedDaily, cached.from || from, cached.to || to, {
            timeZone,
            offsetMinutes: tzOffsetMinutes,
            now,
          })
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

function fillDailyGaps(rows, from, to, { timeZone, offsetMinutes, now } = {}) {
  const start = parseUtcDate(from);
  const end = parseUtcDate(to);
  if (!start || !end || end < start) return Array.isArray(rows) ? rows : [];

  const baseDate =
    now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const todayKey = getLocalDayKey({ timeZone, offsetMinutes, date: baseDate });
  const today = parseUtcDate(todayKey);
  const todayTime = today ? today.getTime() : baseDate.getTime();

  const byDay = new Map();
  for (const row of rows || []) {
    if (row?.day) byDay.set(row.day, row);
  }

  const filled = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const day = formatDateUTC(cursor);
    const existing = byDay.get(day);
    const isFuture = cursor.getTime() > todayTime;
    if (existing) {
      filled.push({ ...existing, missing: false, future: isFuture });
      continue;
    }
    filled.push({
      day,
      total_tokens: null,
      billable_total_tokens: null,
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
