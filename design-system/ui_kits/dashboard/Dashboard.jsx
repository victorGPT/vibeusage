// Dashboard.jsx — VibeUsage Operations Deck (faithful recreation)
// Mirrors upstream dashboard/src/ui/matrix-a/views/DashboardView.jsx
// Layout: 4/8 two-column, left = identity stack, right = project + core + breakdown + details

const DB_PERIODS = ["DAY", "WEEK", "MONTH", "TOTAL"];

/* Sample data ─ identity */
const VU_IDENTITY = {
  name: "victor_wu",
  start: "2025-11-10",
  days: 162,
  subscriptions: ["CLAUDE MAX", "OPENCLAW ENABLED", "OPENCODE PRO", "CODEX PRO"],
};

/* Sample data ─ projects (top 3) */
const VU_PROJECTS = [
  { owner: "victorgpt", repo: "vibeusage", stars: 114, tokens: "4.5B" },
  { owner: "openclaw", repo: "openclaw", stars: "364.8K", tokens: "888.8M",
    avatarBg: "#9B1B1B" },
  { owner: "victorgpt", repo: "bigbottle", stars: 0, tokens: "274.5M" },
];

/* Sample data ─ top models */
const VU_TOP_MODELS = [
  { name: "GPT-5.4",          percent: "80.8" },
  { name: "KIMI-K2.5",        percent: "15.8" },
  { name: "CLAUDE-OPUS-4.7",  percent: "3.4" },
];

/* Sample data ─ rolling */
const VU_ROLLING = { last7d: "3.2B", last30d: "8.8B", avgActiveDay: "294.7M" };

/* Sample data ─ model breakdown grouped by source */
const VU_BREAKDOWN = [
  { name: "HERMES",   usage: "4M",     percent: 80.8, subs: [{ name: "GPT-5.4", percent: 100 }] },
  { name: "OPENCLAW", usage: "789.6K", percent: 15.8, subs: [{ name: "KIMI-K2.5", percent: 100 }] },
  { name: "CLAUDE",   usage: "168K",   percent: 3.4,  subs: [{ name: "CLAUDE-OPUS-4…", percent: 100 }] },
];

/* Sample data ─ details */
const VU_DETAILS = [
  { date: "2026-04-27", total: 4987486, input: 4853717, output: 10703, cached: 123066, reasoning: 0 },
];

/* Period -> hero values */
const VU_PERIOD_TOTALS = {
  DAY:   { total:    18934, cost:    8.42, range: "2026-04-26..2026-04-27" },
  WEEK:  { total:  4987486, cost:   10.85, range: "2026-04-27..2026-05-03" },
  MONTH: { total: 22041008, cost:   48.20, range: "2026-04-01..2026-04-30" },
  TOTAL: { total:144203998, cost: 1964.48, range: "2025-11-10..2026-05-03" },
};

/* Trend axis ticks (~5 anchors) and dense daily series. */
const VU_TREND_AXIS = {
  DAY:   ["00:00", "06:00", "12:00", "18:00", "23:00"],
  WEEK:  ["04-21", "04-23", "04-25", "04-27", "04-30"],
  MONTH: ["04-01", "04-08", "04-16", "04-23", "04-30"],
  TOTAL: ["NOV", "DEC", "JAN", "FEB", "APR"],
};
function vuTrendData(period) {
  // Deterministic pseudo-random using LCG so same seed → same shape.
  let s = period.charCodeAt(0) * 7919 + 11;
  const rand = () => (s = (s * 9301 + 49297) % 233280, s / 233280);
  const noise = (amp) => (rand() - 0.5) * 2 * amp;
  const max = VU_PERIOD_TOTALS[period].total;
  if (period === "DAY") {
    // 24 hourly buckets, ramp + small bursts
    return Array.from({ length: 24 }, (_, h) => {
      const base = max * (0.05 + 0.6 * Math.exp(-Math.pow((h - 14) / 4, 2)));
      return Math.max(0, base + noise(max * 0.04));
    });
  }
  if (period === "WEEK") {
    // 7 daily buckets — sharp single-day peak similar to upstream
    return [0.92, 0.05, 0.05, 0.05, 0.05, 0.07, 0.06].map((p) => max * p + noise(max * 0.01));
  }
  if (period === "MONTH") {
    // 30 daily buckets — early peak, mid trough, late surge (matches your screenshot)
    return Array.from({ length: 30 }, (_, d) => {
      const earlySpike = Math.exp(-Math.pow((d - 1) / 1.2, 2)) * 1.0;
      const lateSurge  = Math.exp(-Math.pow((d - 23) / 2.6, 2)) * 0.78;
      const midNoise   = (Math.sin(d * 0.7) + Math.cos(d * 1.3) + 2) * 0.05;
      return Math.max(0, max * (earlySpike + lateSurge + midNoise * 0.25) + noise(max * 0.015));
    });
  }
  // TOTAL — 26 weekly buckets, gradual ramp
  return Array.from({ length: 26 }, (_, w) => {
    const ramp = Math.pow(w / 25, 1.4);
    return max * (0.05 + ramp * 0.95) + noise(max * 0.04);
  });
}

/* ─── DASHBOARD ROOT ────────────────────────────────────────────── */
function Dashboard() {
  const [period, setPeriod] = React.useState("WEEK");
  const [cheats, setCheats] = React.useState(false);
  const [toast, setToast] = React.useState("");

  const onRefresh = () => {
    setToast("SYNCING_NEURAL_WEIGHTS… OK");
    setTimeout(() => setToast(""), 1600);
  };

  React.useEffect(() => {
    const h = (e) => {
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "d") setPeriod("DAY");
      else if (k === "w") setPeriod("WEEK");
      else if (k === "m") setPeriod("MONTH");
      else if (k === "t") setPeriod("TOTAL");
      else if (k === "r") onRefresh();
      else if (k === "?" || k === "/") setCheats((v) => !v);
      else if (k === "escape") setCheats(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const totals = VU_PERIOD_TOTALS[period];

  return (
    <div className="vu-shell">
      <div className="fx-rain"><MatrixRain /></div>
      <div className="fx-crt-overlay" />
      <div className="fx-scan" />

      <Header stars={114} />

      <div className="vu-grid">
        {/* LEFT COLUMN ── 4 of 12 */}
        <div className="vu-col-left">
          <IdentityCard {...VU_IDENTITY} />
          <RollingUsagePanel {...VU_ROLLING} />
          <TopModelsPanel rows={VU_TOP_MODELS} />
          <PublicProfilePanel />
          <TrendChart
            data={vuTrendData(period)}
            axisTicks={VU_TREND_AXIS[period]}
          />
          <ActivityHeatmap />
        </div>

        {/* RIGHT COLUMN ── 8 of 12 */}
        <div className="vu-col-right">
          <ProjectUsagePanel entries={VU_PROJECTS} />
          <CoreIndexPanel
            period={period}
            setPeriod={setPeriod}
            total={totals.total}
            cost={totals.cost}
            rangeLabel={totals.range}
            onRefresh={onRefresh}
          />
          <ModelBreakdownPanel groups={VU_BREAKDOWN} />
          <DetailsPanel rows={VU_DETAILS} />
        </div>
      </div>

      <FloatingChrome onCheats={() => setCheats(true)} />
      <CheatsheetModal open={cheats} onClose={() => setCheats(false)} />
      <FooterBar />

      {toast ? <div className="vu-toast">{toast}</div> : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Dashboard />);
