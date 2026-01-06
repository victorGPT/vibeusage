import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildActivityHeatmap,
  computeActiveStreakDays,
  getHeatmapRangeLocal,
} from "../lib/activity-heatmap.js";
import { isMockEnabled } from "../lib/mock-data.js";
import { getUsageDaily, getUsageHeatmap } from "../lib/vibescore-api.js";
import { getTimeZoneCacheKey } from "../lib/timezone.js";

export function useActivityHeatmap({
  baseUrl,
  accessToken,
  weeks = 52,
  weekStartsOn = "sun",
  cacheKey,
  timeZone,
  tzOffsetMinutes,
  now,
} = {}) {
  const range = useMemo(() => {
    return getHeatmapRangeLocal({ weeks, weekStartsOn, now });
  }, [now, weeks, weekStartsOn]);
  const [daily, setDaily] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [source, setSource] = useState("edge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mockEnabled = isMockEnabled();

  const storageKey = useMemo(() => {
    if (!cacheKey) return null;
    const tzKey = getTimeZoneCacheKey({ timeZone, offsetMinutes: tzOffsetMinutes });
    return `vibeusage.heatmap.${cacheKey}.${weeks}.${weekStartsOn}.${tzKey}`;
  }, [cacheKey, timeZone, tzOffsetMinutes, weeks, weekStartsOn]);

  const readCache = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.heatmap) return null;
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
      try {
        const res = await getUsageHeatmap({
          baseUrl,
          accessToken,
          weeks,
          to: range.to,
          weekStartsOn,
          timeZone,
          tzOffsetMinutes,
        });
        const weeksData = Array.isArray(res?.weeks) ? res.weeks : [];
        if (!weeksData.length) {
          const cached = readCache();
          if (cached?.heatmap) {
            setHeatmap(cached.heatmap);
            setDaily(cached.daily || []);
            setSource("cache");
            return;
          }
        }
        const hasLevels = weeksData.some((week) =>
          (Array.isArray(week) ? week : []).some((cell) =>
            cell && Number.isFinite(Number(cell.level))
          )
        );
        if (!hasLevels && weeksData.length) {
          const rows = [];
          for (const week of weeksData) {
            for (const cell of Array.isArray(week) ? week : []) {
              if (!cell?.day) continue;
              rows.push({
                day: cell.day,
                total_tokens: cell.total_tokens ?? cell.value ?? 0,
                billable_total_tokens:
                  cell.billable_total_tokens ?? cell.value ?? cell.total_tokens ?? 0,
              });
            }
          }
          const localHeatmap = buildActivityHeatmap({
            dailyRows: rows,
            weeks,
            to: res?.to || range.to,
            weekStartsOn,
          });
          setDaily(rows);
          setHeatmap({
            ...localHeatmap,
            week_starts_on: weekStartsOn,
            active_days: rows.filter(
              (r) => Number(r?.billable_total_tokens ?? r?.total_tokens) > 0
            ).length,
            streak_days: computeActiveStreakDays({
              dailyRows: rows,
              to: res?.to || range.to,
            }),
          });
          setSource("client");
          writeCache({
            heatmap: {
              ...localHeatmap,
              week_starts_on: weekStartsOn,
              active_days: rows.filter(
                (r) => Number(r?.billable_total_tokens ?? r?.total_tokens) > 0
              ).length,
              streak_days: computeActiveStreakDays({
                dailyRows: rows,
                to: res?.to || range.to,
              }),
            },
            daily: rows,
            fetchedAt: new Date().toISOString(),
          });
          return;
        }

        setHeatmap(res || null);
        setDaily([]);
        setSource("edge");
        if (res) {
          writeCache({
            heatmap: res,
            daily: [],
            fetchedAt: new Date().toISOString(),
          });
        }
        return;
      } catch (e) {
        const status = e?.status ?? e?.statusCode;
        if (status === 401 || status === 403) throw e;
      }

      const dailyRes = await getUsageDaily({
        baseUrl,
        accessToken,
        from: range.from,
        to: range.to,
        timeZone,
        tzOffsetMinutes,
      });
      const rows = Array.isArray(dailyRes?.data) ? dailyRes.data : [];
      setDaily(rows);
      const localHeatmap = buildActivityHeatmap({
        dailyRows: rows,
        weeks,
        to: range.to,
        weekStartsOn,
      });
      setHeatmap({
        ...localHeatmap,
        week_starts_on: weekStartsOn,
        active_days: rows.filter(
          (r) => Number(r?.billable_total_tokens ?? r?.total_tokens) > 0
        ).length,
        streak_days: computeActiveStreakDays({ dailyRows: rows, to: range.to }),
      });
      setSource("client");
      writeCache({
        heatmap: {
          ...localHeatmap,
          week_starts_on: weekStartsOn,
          active_days: rows.filter(
            (r) => Number(r?.billable_total_tokens ?? r?.total_tokens) > 0
          ).length,
          streak_days: computeActiveStreakDays({ dailyRows: rows, to: range.to }),
        },
        daily: rows,
        fetchedAt: new Date().toISOString(),
      });
    } catch (e) {
      const cached = readCache();
      if (cached?.heatmap) {
        setHeatmap(cached.heatmap);
        setDaily(cached.daily || []);
        setSource("cache");
        setError(null);
      } else {
        setError(e?.message || String(e));
        setDaily([]);
        setHeatmap(null);
        setSource("edge");
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    baseUrl,
    mockEnabled,
    range.from,
    range.to,
    readCache,
    timeZone,
    tzOffsetMinutes,
    weekStartsOn,
    weeks,
    writeCache,
  ]);

  useEffect(() => {
    if (!accessToken && !mockEnabled) {
      setDaily([]);
      setLoading(false);
      setError(null);
      setHeatmap(null);
      setSource("edge");
      return;
    }
    const cached = readCache();
    if (cached?.heatmap) {
      setHeatmap(cached.heatmap);
      setDaily(cached.daily || []);
      setSource("cache");
    }
    refresh();
  }, [accessToken, mockEnabled, readCache, refresh]);

  const normalizedSource = mockEnabled
    ? "mock"
    : source === "client"
      ? "edge"
      : source;

  return { range, daily, heatmap, source: normalizedSource, loading, error, refresh };
}
