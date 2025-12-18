import { useState, useMemo } from "react";

function getInsforgeBaseUrl() {
  return (
    import.meta.env.VITE_VIBESCORE_INSFORGE_BASE_URL ||
    "https://5tmappuk.us-east.insforge.app"
  );
}

function formatDateUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function useVibeData(auth) {
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const [from, setFrom] = useState(() => {
    const today = new Date();
    return formatDateUTC(
      new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - 29
        )
      )
    );
  });
  const [to, setTo] = useState(() => {
    const today = new Date();
    return formatDateUTC(today);
  });

  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchJson(url, { method, headers } = {}) {
    const res = await fetch(url, {
      method: method || "GET",
      headers: {
        ...(headers || {}),
      },
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_e) {}

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

  async function refresh() {
    if (!auth?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${auth.accessToken}` };
      const dailyUrl = new URL("/functions/vibescore-usage-daily", baseUrl);
      dailyUrl.searchParams.set("from", from);
      dailyUrl.searchParams.set("to", to);

      const summaryUrl = new URL("/functions/vibescore-usage-summary", baseUrl);
      summaryUrl.searchParams.set("from", from);
      summaryUrl.searchParams.set("to", to);

      const [dailyRes, summaryRes] = await Promise.all([
        fetchJson(dailyUrl.toString(), { headers }),
        fetchJson(summaryUrl.toString(), { headers }),
      ]);

      setDaily(Array.isArray(dailyRes?.data) ? dailyRes.data : []);
      setSummary(summaryRes?.totals || null);
    } catch (e) {
      setError(e?.message || String(e));
      setDaily([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  return {
    from,
    setFrom,
    to,
    setTo,
    daily,
    setDaily,
    summary,
    setSummary,
    loading,
    error,
    refresh,
    baseUrl,
  };
}
