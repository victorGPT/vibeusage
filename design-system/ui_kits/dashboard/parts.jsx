// parts.jsx — VibeUsage Operations Deck — shared primitives + sub-panels
// SSOT: ../../colors_and_type.css + upstream DashboardView.jsx
// Loaded BEFORE Dashboard.jsx; exports onto window so Dashboard.jsx can read.

const { useState, useEffect, useMemo, useRef } = React;

/* ─── SCRAMBLE ──────────────────────────────────────────────────── */
const SCRAMBLE_POOL = "0123456789ABCDEFXYZ@#$%_/\\|".split("");
function ScrambleText({ children, duration = 1100, className = "" }) {
  const final = String(children);
  const [t, setT] = useState("");
  useEffect(() => {
    let raf, start;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const reveal = Math.floor(p * final.length);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        if (i < reveal || final[i] === " ") out += final[i];
        else out += SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
      }
      setT(out);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [final, duration]);
  return <span className={className}>{t || final}</span>;
}

/* ─── ASCII PANEL (matches AsciiBox.jsx — title chip + corner glyphs) ── */
function Panel({ title, subtitle, weight = "secondary", children, stamp, className = "", titleRight }) {
  const tone = weight === "primary" ? "frame-primary" : "frame-secondary";
  return (
    <div className={`vu-panel ${tone} ${className}`}>
      <div className="vu-frame-top">
        <span className="vu-corner">┌</span>
        {title ? (
          <span className="vu-title-chip">
            {title}
            {subtitle ? <span className="vu-title-sub"> [{subtitle}]</span> : null}
          </span>
        ) : null}
        <span className="vu-frame-h" />
        {titleRight ? <span className="vu-title-right">{titleRight}</span> : null}
        <span className="vu-corner">┐</span>
      </div>
      <div className="vu-frame-body">{children}</div>
      <div className="vu-frame-bot">
        <span className="vu-corner">└</span>
        <span className="vu-frame-h" />
        {stamp ? <span className="vu-bot-stamp">[ {stamp} ]</span> : null}
        <span className="vu-corner">┘</span>
      </div>
    </div>
  );
}

/* ─── MATRIX AVATAR (5×5 mirrored bit-pattern, like MatrixAvatar.jsx) ── */
function MatrixAvatar({ seed, size = 64, gold = false }) {
  let h = 5381;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  const cells = [];
  for (let i = 0; i < 15; i++) cells.push(((h >> (i % 30)) & 1) === 1);
  return (
    <svg
      viewBox="0 0 5 5"
      width={size}
      height={size}
      className={`vu-iden ${gold ? "is-gold" : ""}`}
      style={{ width: size, height: size, flexShrink: 0, display: "block" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {cells.map((on, i) => {
        if (!on) return null;
        const r = Math.floor(i / 3),
          c = i % 3;
        return (
          <React.Fragment key={i}>
            <rect x={c} y={r} width="1" height="1" />
            {c < 2 ? <rect x={4 - c} y={r} width="1" height="1" /> : null}
          </React.Fragment>
        );
      })}
    </svg>
  );
}

/* ─── PILL BUTTON with corner ASCII ticks (header / actions) ──────── */
function Pill({ children, primary, onClick, as = "button", href, ariaLabel, className = "" }) {
  const Tag = as === "a" ? "a" : "button";
  return (
    <Tag
      className={`vu-pill ${primary ? "is-primary" : ""} ${className}`}
      onClick={onClick}
      href={href}
      aria-label={ariaLabel}
    >
      <span className="vu-pill-tick tl">┌</span>
      <span className="vu-pill-tick tr">┐</span>
      <span className="vu-pill-label">{children}</span>
      <span className="vu-pill-tick bl">└</span>
      <span className="vu-pill-tick br">┘</span>
    </Tag>
  );
}

/* ─── HEADER (logo + wordmark + status indicator + action row) ────── */
function Header({ stars = 114 }) {
  return (
    <header className="vu-header">
      <div className="vu-brand">
        <img src="../../assets/icon.svg" alt="" className="vu-logo" />
        <span className="vu-wordmark">VIBE</span>
        <span className="vu-wordmark-sub">usage</span>
        <span className="vu-status-pip" aria-hidden="true">[<span className="vu-pip-dot" />]</span>
        <span className="vu-deco-band">
          BENCHMARK · OPERATIONS · SYSTEM
        </span>
      </div>
      <div className="vu-header-actions">
        <Pill as="a" href="https://github.com/victorGPT/vibeusage" ariaLabel="Star on GitHub">
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" style={{verticalAlign:"-1px",marginRight:6}}><path fill="currentColor" d="M8 0C3.6 0 0 3.6 0 8c0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1.1-2.7-1.1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.2 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4C13.7 14.5 16 11.5 16 8c0-4.4-3.6-8-8-8z"/></svg>
          STAR {stars}
        </Pill>
        <Pill as="a" href="#leaderboard" ariaLabel="Leaderboard">
          <span style={{color:"var(--gold)",marginRight:6,fontWeight:900}}>$</span>
          LEADERBOARD
        </Pill>
        <Pill ariaLabel="Sign out">SIGN OUT</Pill>
      </div>
    </header>
  );
}

/* ─── IDENTITY CARD ──────────────────────────────────────────────── */
function IdentityCard({ name = "victor_wu", start = "2025-11-10", days = 162, subscriptions = [] }) {
  return (
    <Panel title="IDENTITY_CORE" subtitle="AUTHORIZED">
      <div className="vu-iden-row">
        <div className="vu-iden-wrap"><MatrixAvatar seed={name} size={80} /></div>
        <div className="vu-iden-meta">
          <div className="vu-iden-handle"><ScrambleText>{name}</ScrambleText></div>
          <div className="vu-iden-stats">
            <div className="vu-stat">
              <div className="vu-stat-lbl">START</div>
              <div className="vu-stat-val vu-gold">{start}</div>
            </div>
            <div className="vu-stat">
              <div className="vu-stat-lbl">ACTIVE</div>
              <div className="vu-stat-val vu-gold">{days} DAY</div>
            </div>
          </div>
          {subscriptions.length ? (
            <div className="vu-subs">
              <div className="vu-subs-lbl">SUBSCRIPTIONS</div>
              <div className="vu-subs-list">
                {subscriptions.map((s, i) => (
                  <span key={i} className="vu-sub-chip">{s}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ─── ROLLING USAGE — three centered tiles ──────────────────────── */
function RollingUsagePanel({ last7d = "3.2B", last30d = "8.8B", avgActiveDay = "294.7M" }) {
  const items = [
    { lbl: "LAST_7_DAYS", val: last7d },
    { lbl: "LAST_30_DAYS", val: last30d },
    { lbl: "AVG_30_DAY", val: avgActiveDay },
  ];
  return (
    <Panel title="RECENT_USAGE">
      <div className="vu-rolling">
        {items.map((it) => (
          <div key={it.lbl} className="vu-rolling-tile">
            <div className="vu-rolling-lbl">{it.lbl}</div>
            <div className="vu-rolling-val">{it.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── TOP MODELS — #01/02/03 horizontal rows ────────────────────── */
function TopModelsPanel({ rows = [] }) {
  const display = Array.from({ length: 3 }, (_, i) => rows[i] || { name: "—", percent: "—" });
  return (
    <Panel title="TOP MODELS" subtitle="ALL_SCORES">
      <div className="vu-tm">
        {display.map((row, i) => (
          <div key={i} className="vu-tm-row">
            <span className="vu-tm-rank">#{String(i + 1).padStart(2, "0")}</span>
            <span className="vu-tm-name">{row.name}</span>
            <span className="vu-tm-pct">{row.percent}<span className="vu-tm-pct-unit">%</span></span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── PUBLIC PROFILE — toggle + share ───────────────────────────── */
function PublicProfilePanel() {
  const [on, setOn] = useState(true);
  const [copied, setCopied] = useState(false);
  return (
    <Panel title="PUBLIC PROFILE">
      <div className="vu-pp">
        <button
          type="button"
          className={`vu-toggle ${on ? "is-on" : ""}`}
          aria-pressed={on}
          onClick={() => setOn((v) => !v)}
        >
          <span className="vu-toggle-dot" />
        </button>
        <span className="vu-pp-lbl">{on ? "PUBLIC_ON" : "PUBLIC_OFF"}</span>
        <button
          type="button"
          className="vu-pp-copy"
          onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          disabled={!on}
        >
          {copied ? "Copied" : "Copy share link"}
        </button>
      </div>
    </Panel>
  );
}

/* ─── PROJECT USAGE — top-N project cards (avatar + stars + tokens) ── */
function ProjectUsagePanel({ entries = [] }) {
  const [limit, setLimit] = useState(3);
  const visible = entries.slice(0, limit);
  return (
    <Panel
      title="PROJECT USAGE"
      subtitle="REPOSITORIES"
      titleRight={
        <span className="vu-proj-toolbar">
          <span className="vu-toolbar-lbl">SHOW</span>
          <button
            type="button"
            className="vu-chip-select"
            onClick={() => setLimit((v) => (v === 3 ? 6 : v === 6 ? 10 : 3))}
            aria-label="Switch project limit"
          >
            TOP {limit} <span className="vu-chip-caret">▾</span>
          </button>
        </span>
      }
    >
      <div className="vu-projs">
        {visible.map((e, i) => (
          <a
            key={i}
            href={`https://github.com/${e.owner}/${e.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vu-proj"
          >
            <div className="vu-proj-stars">
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M8 1.1 10.1 5.4l4.8.7-3.5 3.4.8 4.8L8 11.9l-4.2 2.4.8-4.8L1.1 6.1l4.8-.7L8 1.1z"/></svg>
              <span className="vu-proj-stars-num">{e.stars}</span>
            </div>
            <div className="vu-proj-id">
              <div className={`vu-proj-avatar ${e.avatarClass || ""}`} style={e.avatarBg ? {background: e.avatarBg} : undefined}>
                {e.avatarUrl ? <img src={e.avatarUrl} alt="" /> : <MatrixAvatar seed={e.owner} size={40} />}
              </div>
              <div className="vu-proj-owner">{e.owner}</div>
            </div>
            <div className="vu-proj-repo">{e.repo}</div>
            <div className="vu-proj-tokens-row">
              <span className="vu-proj-tokens-lbl">TOKENS</span>
              <span className="vu-proj-tokens-val">{e.tokens}</span>
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
}

/* ─── CORE INDEX — period tabs + huge total + cost + range ──────── */
function CoreIndexPanel({ period, setPeriod, total, cost, rangeLabel, onRefresh }) {
  const PERIODS = ["DAY", "WEEK", "MONTH", "TOTAL"];
  return (
    <Panel title="CORE_INDEX" weight="primary">
      <div className="vu-core-head">
        <div className="vu-tabs">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`vu-tab ${p === period ? "is-active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="vu-core-meta">
          <span className="vu-meta-lbl">DATA_SOURCE:</span>
          <span className="vu-meta-val">EDGE</span>
          <span className="vu-meta-sep">▸</span>
          <Pill primary onClick={onRefresh}>REFRESH</Pill>
        </div>
      </div>

      <div className="vu-core-body">
        <div className="vu-core-lbl">TOTAL_TOKENS</div>
        <div className="vu-core-num fx-glitch">{total.toLocaleString()}</div>
        <div className="vu-core-cost">
          ${cost.toFixed(2)} <span className="vu-key">[ KEY ]</span>
        </div>
      </div>

      <div className="vu-core-foot">RANGE: {rangeLabel} LOCAL_TIME (UTC+09:00)</div>
    </Panel>
  );
}

/* ─── MODEL BREAKDOWN — grouped per source (HERMES / OPENCLAW / CLAUDE) ── */
function ModelBreakdownPanel({ groups = [] }) {
  return (
    <Panel title="MODEL BREAKDOWN">
      <div className="vu-mbd">
        {groups.map((g, i) => (
          <div key={i} className="vu-mbd-group">
            <div className="vu-mbd-head">
              <span className="vu-mbd-name">{g.name}</span>
              <span className="vu-mbd-usage">USAGE: {g.usage}</span>
              <span className="vu-mbd-pct">{g.percent}<span className="vu-mbd-pct-unit">%</span></span>
            </div>
            <div className="vu-mbd-bar"><div className="vu-mbd-fill" style={{width: g.percent + "%"}} /></div>
            <div className="vu-mbd-subs">
              {g.subs.map((s, j) => (
                <span key={j} className="vu-mbd-sub">
                  <span className="vu-mbd-square" />
                  <span className="vu-mbd-sub-name">{s.name}</span>
                  <span className="vu-mbd-sub-pct">{s.percent}%</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ─── DETAILS TABLE — sortable daily rows ───────────────────────── */
function DetailsPanel({ rows = [] }) {
  const [sortKey, setSortKey] = useState("date");
  const [dir, setDir] = useState("desc");
  const cols = [
    { key: "date", label: "DATE" },
    { key: "total", label: "TOTAL" },
    { key: "input", label: "INPUT" },
    { key: "output", label: "OUTPUT" },
    { key: "cached", label: "CACHED" },
    { key: "reasoning", label: "REASONING" },
  ];
  const sorted = useMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, dir]);
  const click = (k) => {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setDir("desc"); }
  };
  const fmt = (n) => typeof n === "number" ? n.toLocaleString() : n;
  const arrow = (k) => (k !== sortKey ? "" : (dir === "asc" ? "↑" : "↓"));
  return (
    <Panel title="DETAILS" subtitle="SORTABLE">
      <div className="vu-details">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} aria-sort={c.key === sortKey ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => click(c.key)}>
                    <span>{c.label}</span>
                    <span className="vu-th-arrow">{arrow(c.key)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.date}>
                <td className="vu-td-date">{r.date}</td>
                <td>{fmt(r.total)}</td>
                <td>{fmt(r.input)}</td>
                <td>{fmt(r.output)}</td>
                <td>{fmt(r.cached)}</td>
                <td>{fmt(r.reasoning)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ─── TREND — smooth-curve line chart with full grid (matches real product) ── */
// Catmull-Rom spline → cubic bezier (continuous C1)
function smoothPath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]}`;
  const tension = 0.5;
  const out = [`M ${pts[0][0]},${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + ((p2[0] - p0[0]) * tension) / 6;
    const cp1y = p1[1] + ((p2[1] - p0[1]) * tension) / 6;
    const cp2x = p2[0] - ((p3[0] - p1[0]) * tension) / 6;
    const cp2y = p2[1] - ((p3[1] - p1[1]) * tension) / 6;
    out.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return out.join(" ");
}

function fmtTokens(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return Math.round(v / 1e6) + "M";
  if (v >= 1e3) return Math.round(v / 1e3) + "K";
  return Math.round(v).toString();
}

function TrendChart({ data, labels, axisTicks }) {
  const values = (data || []).map((n) => Number(n) || 0);
  const max = Math.max(...values, 1);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  const W = 320, H = 156;
  const padL = 8, padR = 38, padT = 10, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const pts = values.map((v, i) => {
    const x = padL + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = padT + innerH - (v / max) * innerH;
    return [x, y];
  });
  const path = smoothPath(pts);

  // Grid: 4 horizontal divisions, ~6 vertical
  const yDivs = 4;
  const xDivs = 6;
  const yTicks = Array.from({ length: yDivs + 1 }, (_, i) => max * (1 - i / yDivs));

  // Render the X-axis labels passed in (5 anchors typical: 04-01 .. 04-30)
  const ticks = axisTicks || labels || [];

  return (
    <Panel title="TREND">
      <div className="vu-trend-meta">
        MAX: <span className="vu-trend-num">{Math.round(max).toLocaleString()}</span>
        &nbsp;&nbsp;&nbsp;AVG: <span className="vu-trend-num">{Math.round(avg).toLocaleString()}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="vu-trend-svg" preserveAspectRatio="none">
        <defs>
          <filter id="vu-trend-glow-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id="vu-trend-glow-wide" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* horizontal grid lines + Y labels (right side) */}
        {yTicks.map((v, i) => {
          const y = padT + (innerH * i) / yDivs;
          return (
            <g key={`yt-${i}`}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(0,255,65,0.10)" strokeWidth="0.5" />
              <text x={W - padR + 6} y={y + 3} textAnchor="start" className="vu-trend-yt">{fmtTokens(v)}</text>
            </g>
          );
        })}

        {/* vertical grid lines */}
        {Array.from({ length: xDivs + 1 }, (_, i) => {
          const x = padL + (innerW * i) / xDivs;
          return <line key={`xv-${i}`} x1={x} x2={x} y1={padT} y2={padT + innerH} stroke="rgba(0,255,65,0.06)" strokeWidth="0.5" />;
        })}

        {/* outer plot frame */}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="rgba(0,255,65,0.18)" strokeWidth="0.6" />

        {/* Subtle area fill — light, just to give the line ground */}
        {path && pts.length > 1 ? (
          <path
            d={path + ` L ${pts[pts.length - 1][0]},${padT + innerH} L ${pts[0][0]},${padT + innerH} Z`}
            fill="rgba(0,255,65,0.08)"
          />
        ) : null}

        {/* glow halo (wide blur) */}
        {path ? <path d={path} stroke="#00FF41" strokeWidth="3" fill="none" opacity="0.35" filter="url(#vu-trend-glow-wide)" /> : null}
        {/* mid glow */}
        {path ? <path d={path} stroke="#00FF41" strokeWidth="1.8" fill="none" opacity="0.7" filter="url(#vu-trend-glow-soft)" /> : null}
        {/* core line */}
        {path ? <path d={path} stroke="#E8FFE9" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>

      <div className="vu-trend-axis">
        {ticks.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </Panel>
  );
}

/* ─── ACTIVITY HEATMAP — 52w × 7d grid with month labels ────────── */
function ActivityHeatmap({ months = ["DEC", "JAN", "FEB", "MAR", "APR"], weeks = 22 }) {
  const cells = useMemo(() => {
    let s = 11;
    const r = () => (s = (s * 9301 + 49297) % 233280, s / 233280);
    const grid = [];
    for (let d = 0; d < 7; d++) {
      const row = [];
      for (let w = 0; w < weeks; w++) {
        const x = r();
        row.push(x > 0.92 ? 4 : x > 0.78 ? 3 : x > 0.55 ? 2 : x > 0.30 ? 1 : 0);
      }
      grid.push(row);
    }
    return grid;
  }, [weeks]);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return (
    <Panel title="ACTIVITY_GRID" subtitle="52W_LOCAL">
      <div className="vu-heat-wrap">
        <div className="vu-heat-months" style={{gridTemplateColumns: `repeat(${months.length}, 1fr)`}}>
          {months.map((m) => <span key={m}>{m}</span>)}
        </div>
        <div className="vu-heat-body">
          <div className="vu-heat-days">
            {days.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="vu-heat-grid" style={{gridTemplateColumns: `repeat(${weeks}, 1fr)`}}>
            {cells.map((row, ri) => row.map((lvl, ci) => (
              <div key={`${ri}-${ci}`} className={`vu-heat-c vu-heat-l${lvl}`} style={{gridRow: ri + 1, gridColumn: ci + 1}} />
            )))}
          </div>
        </div>
        <div className="vu-heat-foot">
          <span className="vu-heat-legend">
            LESS
            <span className="vu-heat-c vu-heat-l0" />
            <span className="vu-heat-c vu-heat-l1" />
            <span className="vu-heat-c vu-heat-l2" />
            <span className="vu-heat-c vu-heat-l3" />
            <span className="vu-heat-c vu-heat-l4" />
            MORE
          </span>
          <span className="vu-heat-tz">UTC+09:00</span>
        </div>
      </div>
    </Panel>
  );
}

/* ─── FLOATING UI: cheatsheet trigger + version badge ───────────── */
function FloatingChrome({ onCheats }) {
  return (
    <>
      <div className="vu-floating">
        <button type="button" className="vu-fab" aria-label="Keyboard shortcuts" onClick={onCheats}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.4" d="M8 12v.01M6 6a2 2 0 1 1 3.5 1.3c-.8.7-1.5 1.1-1.5 2"/></svg>
        </button>
        <button type="button" className="vu-fab" aria-label="Settings">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M2 4h12v1.5H2zM2 7.25h12v1.5H2zM2 10.5h12V12H2z"/></svg>
        </button>
      </div>
      <div className="vu-version">
        <span className="vu-version-lbl">VERSION</span>
        <span className="vu-version-num">0.6.2</span>
      </div>
    </>
  );
}

/* ─── CHEATSHEET MODAL ──────────────────────────────────────────── */
function CheatsheetModal({ open, onClose }) {
  if (!open) return null;
  const binds = [
    ["D", "Period: Day"],
    ["W", "Period: Week"],
    ["M", "Period: Month"],
    ["T", "Period: Total"],
    ["R", "Refresh data"],
    ["?", "Show this menu"],
  ];
  return (
    <div className="vu-modal" onClick={onClose}>
      <div className="vu-modal-panel" onClick={(e) => e.stopPropagation()}>
        <Panel title="KEYBOARD" subtitle="SHORTCUTS">
          <div className="vu-cheats">
            {binds.map(([k, v]) => (
              <div key={k} className="vu-cheats-row">
                <kbd>{k}</kbd><span>{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────────── */
function FooterBar() {
  return (
    <footer className="vu-footer">
      <span>Local time (UTC+09:00) · click Refresh to reload</span>
      <span className="vu-deco-band">VibeUsage_Deck</span>
    </footer>
  );
}

/* ─── MATRIX RAIN ───────────────────────────────────────────────── */
function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const fit = () => { cvs.width = innerWidth; cvs.height = innerHeight; };
    fit();
    addEventListener("resize", fit);
    const fontSize = 14;
    const cols = Math.floor(innerWidth / fontSize);
    const drops = Array(cols).fill(0).map(() => Math.random() * 50);
    const chars = "01XYZA@#$%カタ".split("");
    let raf;
    const draw = () => {
      ctx.fillStyle = "rgba(5,5,5,0.10)";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.font = `${fontSize}px Geist Mono, monospace`;
      ctx.fillStyle = "rgba(0,255,65,0.55)";
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > cvs.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }
      raf = setTimeout(() => requestAnimationFrame(draw), 90);
    };
    draw();
    return () => { clearTimeout(raf); removeEventListener("resize", fit); };
  }, []);
  return <canvas ref={ref} className="vu-rain" />;
}

/* Export to window so Dashboard.jsx (separate <script> scope) can use them */
Object.assign(window, {
  ScrambleText, Panel, MatrixAvatar, Pill, Header,
  IdentityCard, RollingUsagePanel, TopModelsPanel, PublicProfilePanel,
  ProjectUsagePanel, CoreIndexPanel, ModelBreakdownPanel, DetailsPanel,
  TrendChart, ActivityHeatmap, FloatingChrome, CheatsheetModal,
  FooterBar, MatrixRain,
});
