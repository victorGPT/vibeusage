import { useCallback, useEffect, useState } from "react";

import { getUsageDaily, getUsageSummary } from "../lib/vibescore-api.js";
import { isMockEnabled } from "../lib/mock-data.js";

export function useUsageData({
  baseUrl,
  accessToken,
  from,
  to,
  includeDaily = true,
} = {}) {
  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mockEnabled = isMockEnabled();

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

      setDaily(includeDaily && Array.isArray(dailyRes?.data) ? dailyRes.data : []);
      setSummary(summaryRes?.totals || null);
    } catch (e) {
      setError(e?.message || String(e));
      setDaily([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, baseUrl, from, includeDaily, mockEnabled, to]);

  useEffect(() => {
    if (!accessToken && !mockEnabled) {
      setDaily([]);
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [accessToken, mockEnabled, refresh]);

  return { daily, summary, loading, error, refresh };
}
