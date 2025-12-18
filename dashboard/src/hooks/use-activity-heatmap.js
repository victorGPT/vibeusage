import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildActivityHeatmap,
  computeActiveStreakDays,
  getHeatmapRangeUtc,
} from "../lib/activity-heatmap.js";
import { fetchJson } from "../lib/http.js";

export function useActivityHeatmap({
  baseUrl,
  accessToken,
  weeks = 52,
  weekStartsOn = "sun",
} = {}) {
  const range = useMemo(() => {
    return getHeatmapRangeUtc({ weeks, weekStartsOn });
  }, [weeks, weekStartsOn]);
  const [daily, setDaily] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [source, setSource] = useState("edge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      try {
        const heatmapUrl = new URL("/functions/vibescore-usage-heatmap", baseUrl);
        heatmapUrl.searchParams.set("weeks", String(weeks));
        heatmapUrl.searchParams.set("to", range.to);
        heatmapUrl.searchParams.set("week_starts_on", weekStartsOn);
        const res = await fetchJson(heatmapUrl.toString(), { headers });
        setHeatmap(res || null);
        setDaily([]);
        setSource("edge");
        return;
      } catch (e) {
        const status = e?.status;
        if (status === 401 || status === 403) throw e;
      }

      const dailyUrl = new URL("/functions/vibescore-usage-daily", baseUrl);
      dailyUrl.searchParams.set("from", range.from);
      dailyUrl.searchParams.set("to", range.to);
      const dailyRes = await fetchJson(dailyUrl.toString(), { headers });
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
        active_days: rows.filter((r) => Number(r?.total_tokens) > 0).length,
        streak_days: computeActiveStreakDays({ dailyRows: rows, to: range.to }),
      });
      setSource("client");
    } catch (e) {
      setError(e?.message || String(e));
      setDaily([]);
      setHeatmap(null);
      setSource("edge");
    } finally {
      setLoading(false);
    }
  }, [accessToken, baseUrl, range.from, range.to, weekStartsOn, weeks]);

  useEffect(() => {
    if (!accessToken) {
      setDaily([]);
      setLoading(false);
      setError(null);
      setHeatmap(null);
      setSource("edge");
      return;
    }
    refresh();
  }, [accessToken, refresh]);

  return { range, daily, heatmap, source, loading, error, refresh };
}
