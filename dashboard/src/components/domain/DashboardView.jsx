import React, { useMemo } from "react";
import MatrixPanel from "../matrix/MatrixPanel";
import MatrixButton from "../matrix/MatrixButton";
import MatrixInput from "../matrix/MatrixInput";
import TrendChart from "../matrix/TrendChart";
import DataRow from "../matrix/DataRow";
import ActivityHeatmap from "../matrix/ActivityHeatmap";
import MatrixTable from "../matrix/MatrixTable";
import MatrixTerminal from "../matrix/MatrixTerminal";

function toDisplayNumber(value) {
  if (value == null) return "-";
  try {
    if (typeof value === "bigint") return new Intl.NumberFormat().format(value);
    if (typeof value === "number") return new Intl.NumberFormat().format(value);
    const s = String(value).trim();
    if (/^[0-9]+$/.test(s)) return new Intl.NumberFormat().format(BigInt(s));
    return s;
  } catch (_e) {
    return String(value);
  }
}

const DashboardView = ({ auth, logout, vibeData, installCmds }) => {
  const { from, setFrom, to, setTo, daily, summary, loading, error, refresh } =
    vibeData;

  const chartData = useMemo(() => {
    if (!daily || daily.length === 0) return Array(24).fill(0); // fallback
    return daily.map((d) => Number(d.total_tokens) || 0);
  }, [daily]);

  const activeNodes = useMemo(() => {
    if (!summary) return [];
    return [
      {
        n: "Total_Tokens",
        v: toDisplayNumber(summary.total_tokens),
        tag: "SIGMA",
      },
      {
        n: "Input_Stream",
        v: toDisplayNumber(summary.input_tokens),
        tag: "RX",
      },
      {
        n: "Output_Stream",
        v: toDisplayNumber(summary.output_tokens),
        tag: "TX",
      },
      {
        n: "Reasoning",
        v: toDisplayNumber(summary.reasoning_output_tokens),
        tag: "WASM",
      },
    ];
  }, [summary]);

  const columns = [
    { label: "Date_Cycle", key: "day" },
    {
      label: "Total_Load",
      key: "total_tokens",
      render: (v) => toDisplayNumber(v),
      align: "right",
    },
    {
      label: "In",
      key: "input_tokens",
      render: (v) => toDisplayNumber(v),
      align: "right",
    },
    {
      label: "Out",
      key: "output_tokens",
      render: (v) => toDisplayNumber(v),
      align: "right",
    },
    {
      label: "Cache_Hit",
      key: "cached_input_tokens",
      render: (v) => toDisplayNumber(v),
      align: "right",
    },
  ];

  if (!auth?.accessToken) {
    // Fallback for unauthenticated state (though App.jsx handles this usually)
    return null;
  }

  return (
    <div className="flex flex-col space-y-6 pb-20">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] opacity-50 uppercase tracking-widest mb-1">
            Authenticated Identity
          </div>
          <div className="text-xl font-bold tracking-tight text-white glow-text">
            {auth.email}
          </div>
          <div className="text-[10px] opacity-30 font-mono mt-1">
            {auth.userId}
          </div>
        </div>
        <MatrixButton onClick={logout} className="text-xs">
          ABORT_SESSION
        </MatrixButton>
      </div>

      {/* Controls */}
      <MatrixPanel title="TEMPORAL_CONTROLS" className="shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <MatrixInput
            label="T_START (UTC)"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <MatrixInput
            label="T_END (UTC)"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <MatrixButton
            primary
            disabled={loading}
            onClick={refresh}
            className="h-[38px]"
          >
            {loading ? "SYNCING..." : "REFRESH_DATA"}
          </MatrixButton>
          <div className="hidden md:flex flex-col justify-end text-[9px] opacity-40 text-right pb-2">
            <span>STATUS: {loading ? "BUSY" : "IDLE"}</span>
            <span>ERRORS: {error ? "1" : "0"}</span>
          </div>
        </div>
        {error && (
          <div className="mt-4 border-l-2 border-red-500 pl-3 md:pl-4 py-1 text-xs text-red-400 bg-red-500/5">
            <span className="font-bold">SYSTEM_FAILURE:</span> {error}
          </div>
        )}
      </MatrixPanel>

      {/* Main Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <MatrixPanel title="NODE_METRICS" subtitle="Aggregated">
            <div className="space-y-0.5">
              {activeNodes.length > 0 ? (
                activeNodes.map((n, i) => (
                  <DataRow key={i} label={n.n} value={n.v} subValue={n.tag} />
                ))
              ) : (
                <div className="p-4 text-center opacity-30 text-xs">
                  Waiting for datastream...
                </div>
              )}
            </div>
          </MatrixPanel>

          <MatrixTerminal
            title="INSTALLATION"
            commands={[
              {
                description: "Initialize Local Environment",
                code: installCmds.init,
              },
              { description: "Synchronize Uplink", code: installCmds.sync },
            ]}
          />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MatrixPanel title="TOKEN_FLOW" subtitle="Trend">
              <TrendChart data={chartData} />
            </MatrixPanel>
            <MatrixPanel title="ACTIVITY_HEATMAP" subtitle="Density">
              <ActivityHeatmap data={daily} />
            </MatrixPanel>
          </div>

          <MatrixPanel title="DAILY_LOGS" subtitle="Tabular_Data">
            <MatrixTable
              columns={columns}
              data={daily}
              className="max-h-[400px]"
            />
          </MatrixPanel>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
