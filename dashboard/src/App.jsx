import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'vibescore.dashboard.auth.v1';

const DAILY_SORT_COLUMNS = [
  { key: 'day', label: 'Date', title: 'Sort by Date' },
  { key: 'total_tokens', label: 'Total', title: 'Sort by Total' },
  { key: 'input_tokens', label: 'Input', title: 'Sort by Input' },
  { key: 'output_tokens', label: 'Output', title: 'Sort by Output' },
  { key: 'cached_input_tokens', label: 'Cached', title: 'Sort by Cached input' },
  { key: 'reasoning_output_tokens', label: 'Reasoning', title: 'Sort by Reasoning output' }
];

function getInsforgeBaseUrl() {
  return import.meta.env.VITE_VIBESCORE_INSFORGE_BASE_URL || 'https://5tmappuk.us-east.insforge.app';
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.accessToken !== 'string' || parsed.accessToken.length === 0) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatDateUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function getDefaultRange() {
  const today = new Date();
  const to = formatDateUTC(today);
  const from = formatDateUTC(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 29)));
  return { from, to };
}

function buildAuthUrl({ baseUrl, path, redirectUrl }) {
  const u = new URL(path, baseUrl);
  u.searchParams.set('redirect', redirectUrl);
  return u.toString();
}

async function fetchJson(url, { method, headers } = {}) {
  const res = await fetch(url, {
    method: method || 'GET',
    headers: {
      ...(headers || {})
    }
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

function toDisplayNumber(value) {
  if (value == null) return '-';
  try {
    if (typeof value === 'bigint') return new Intl.NumberFormat().format(value);
    if (typeof value === 'number') return new Intl.NumberFormat().format(value);
    const s = String(value).trim();
    if (/^[0-9]+$/.test(s)) return new Intl.NumberFormat().format(BigInt(s));
    return s;
  } catch (_e) {
    return String(value);
  }
}

function toFiniteNumber(value) {
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function toDigitString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const stripped = s.replace(/^0+/, '');
  return stripped.length === 0 ? '0' : stripped;
}

function compareIntLike(a, b) {
  const sa = toDigitString(a);
  const sb = toDigitString(b);
  if (sa && sb) {
    if (sa.length !== sb.length) return sa.length < sb.length ? -1 : 1;
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
  }

  const na = toFiniteNumber(a);
  const nb = toFiniteNumber(b);
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}

function compareDayString(a, b) {
  const sa = typeof a === 'string' ? a : String(a || '');
  const sb = typeof b === 'string' ? b : String(b || '');
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

function sortDailyRows(rows, { key, dir }) {
  const direction = dir === 'asc' ? 1 : -1;
  const items = Array.isArray(rows) ? rows : [];

  const cmp = key === 'day' ? compareDayString : compareIntLike;

  return items
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = a.row?.[key];
      const bv = b.row?.[key];

      const aMissing = av == null;
      const bMissing = bv == null;
      if (aMissing && bMissing) return a.index - b.index;
      if (aMissing) return 1;
      if (bMissing) return -1;

      const base = cmp(av, bv);
      if (base !== 0) return base * direction;
      return a.index - b.index;
    })
    .map((x) => x.row);
}

function Sparkline({ rows }) {
  const values = (rows || []).map((r) => toFiniteNumber(r?.total_tokens)).filter((n) => typeof n === 'number');
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const w = 720;
  const h = 120;
  const padX = 8;
  const padY = 10;

  const pts = values.map((v, i) => {
    const x = padX + (i * (w - padX * 2)) / (values.length - 1);
    const y = padY + (1 - (v - min) / span) * (h - padY * 2);
    return { x, y };
  });

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="120" aria-label="Daily token usage sparkline">
      <path
        className="tui-sparkline"
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MatrixRain() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduceMotion) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const fontSize = 14;
    const chars =
      'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%*+-=<>?';

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops = [];
    let raf = 0;

    function resize() {
      width = window.innerWidth || 0;
      height = window.innerHeight || 0;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.max(1, Math.floor(width / fontSize));
      drops = Array.from({ length: columns }, () => Math.floor((Math.random() * height) / fontSize));

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.textBaseline = 'top';
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    let last = 0;
    const fps = 28;
    const frameInterval = 1000 / fps;

    function draw(ts) {
      if (!last) last = ts;
      const dt = ts - last;
      if (dt < frameInterval) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      last = ts;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(0, 255, 65, 0.85)';

      for (let i = 0; i < drops.length; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, x, y);

        if (y > height && Math.random() > 0.975) drops[i] = 0;
        else drops[i] += 1;
      }

      raf = window.requestAnimationFrame(draw);
    }

    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="tui-matrix" aria-hidden="true" />;
}

function TuiFrame({ title, right, footer, children }) {
  return (
    <div className="tui-screen">
      <MatrixRain />
      <div className="tui-frame">
        <div className="tui-header">
          <div className="tui-title">{title}</div>
          <div className="tui-spacer" />
          {right}
        </div>
        <div className="tui-body">{children}</div>
        <div className="tui-footer">
          <span className="muted">{footer}</span>
        </div>
      </div>
    </div>
  );
}

function TuiWindow({ title, right, children }) {
  return (
    <div className="tui-window">
      <div className="tui-window-bar">
        <div className="tui-window-title">{title}</div>
        <div className="tui-spacer" />
        {right}
      </div>
      <div className="tui-window-body">{children}</div>
    </div>
  );
}

function ConnectCliPage({ defaultInsforgeBaseUrl }) {
  const url = useMemo(() => new URL(window.location.href), []);
  const redirect = url.searchParams.get('redirect') || '';
  const baseUrlOverride = url.searchParams.get('base_url') || '';

  let redirectUrl = null;
  try {
    redirectUrl = new URL(redirect);
  } catch (_e) {}

  const safeRedirect =
    redirectUrl && redirectUrl.protocol === 'http:' && (redirectUrl.hostname === '127.0.0.1' || redirectUrl.hostname === 'localhost')
      ? redirectUrl.toString()
      : null;

  const insforgeBaseUrl = baseUrlOverride || defaultInsforgeBaseUrl;

  const signInUrl = useMemo(() => {
    if (!safeRedirect) return null;
    return buildAuthUrl({ baseUrl: insforgeBaseUrl, path: '/auth/sign-in', redirectUrl: safeRedirect });
  }, [insforgeBaseUrl, safeRedirect]);

  const signUpUrl = useMemo(() => {
    if (!safeRedirect) return null;
    return buildAuthUrl({ baseUrl: insforgeBaseUrl, path: '/auth/sign-up', redirectUrl: safeRedirect });
  }, [insforgeBaseUrl, safeRedirect]);

  return (
    <TuiFrame
      title="VibeScore"
      right={<span className="muted">Connect CLI</span>}
      footer="Click sign-in/sign-up. On success, your browser returns to the local CLI callback."
    >
      <TuiWindow title="Link your CLI">
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in or sign up. When finished, the browser will return to your local CLI to complete setup.
        </p>

        {!safeRedirect ? (
          <div className="muted" style={{ marginTop: 12, color: 'var(--error)' }}>
            Invalid or missing <code>redirect</code> URL. This page must be opened from the CLI.
          </div>
        ) : (
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn primary" href={signInUrl}>
              $ sign-in
            </a>
            <a className="btn" href={signUpUrl}>
              $ sign-up
            </a>
          </div>
        )}
      </TuiWindow>
    </TuiFrame>
  );
}

export default function App() {
  const baseUrl = useMemo(() => getInsforgeBaseUrl(), []);
  const [auth, setAuth] = useState(() => loadAuth());
  const isLocalhost = useMemo(() => {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  }, []);
  const installInitCmd = isLocalhost ? 'node bin/tracker.js init' : 'npx --yes @vibescore/tracker init';
  const installSyncCmd = isLocalhost ? 'node bin/tracker.js sync' : 'npx --yes @vibescore/tracker sync';

  const routePath = useMemo(() => window.location.pathname.replace(/\/+$/, '') || '/', []);
  if (routePath === '/connect') {
    return <ConnectCliPage defaultInsforgeBaseUrl={baseUrl} />;
  }

  const range = useMemo(() => getDefaultRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [sort, setSort] = useState(() => ({ key: 'day', dir: 'desc' }));
  const sortedDaily = useMemo(() => sortDailyRows(daily, sort), [daily, sort]);
  const sparklineRows = useMemo(() => sortDailyRows(daily, { key: 'day', dir: 'asc' }), [daily]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'desc' };
    });
  }

  function ariaSortFor(key) {
    if (sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  function sortIconFor(key) {
    if (sort.key !== key) return '';
    return sort.dir === 'asc' ? '^' : 'v';
  }

  const redirectUrl = useMemo(() => `${window.location.origin}/auth/callback`, []);
  const signInUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: '/auth/sign-in', redirectUrl }),
    [baseUrl, redirectUrl]
  );
  const signUpUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: '/auth/sign-up', redirectUrl }),
    [baseUrl, redirectUrl]
  );

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path !== '/auth/callback') return;

    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token') || '';
    if (!accessToken) return;

    const next = {
      accessToken,
      userId: params.get('user_id') || null,
      email: params.get('email') || null,
      name: params.get('name') || null,
      savedAt: new Date().toISOString()
    };
    saveAuth(next);
    setAuth(next);
    window.history.replaceState({}, '', '/');
  }, []);

  async function refresh() {
    if (!auth?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${auth.accessToken}` };
      const dailyUrl = new URL('/functions/vibescore-usage-daily', baseUrl);
      dailyUrl.searchParams.set('from', from);
      dailyUrl.searchParams.set('to', to);

      const summaryUrl = new URL('/functions/vibescore-usage-summary', baseUrl);
      summaryUrl.searchParams.set('from', from);
      summaryUrl.searchParams.set('to', to);

      const [dailyRes, summaryRes] = await Promise.all([
        fetchJson(dailyUrl.toString(), { headers }),
        fetchJson(summaryUrl.toString(), { headers })
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

  useEffect(() => {
    if (!auth?.accessToken) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.accessToken, from, to]);

  const signedIn = Boolean(auth?.accessToken);
  const title = 'VibeScore';

  const headerRight = signedIn ? (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      <span className="muted">{auth?.email ? auth.email : 'Signed in'}</span>
      <button
        className="btn"
        onClick={() => {
          clearAuth();
          setAuth(null);
          setDaily([]);
          setSummary(null);
        }}
      >
        Sign out
      </button>
    </div>
  ) : (
    <span className="muted">Not signed in</span>
  );

  return (
    <TuiFrame title={title} right={headerRight} footer={signedIn ? 'UTC aggregates • click Refresh to reload' : 'Sign in to view UTC token aggregates'}>
      {!signedIn ? (
        <TuiWindow title="Auth required">
          <p className="muted" style={{ marginTop: 0 }}>
            Sign in / sign up to view your daily token usage (UTC).
          </p>

          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn primary" href={signInUrl}>
              $ sign-in
            </a>
            <a className="btn" href={signUpUrl}>
              $ sign-up
            </a>
          </div>
        </TuiWindow>
      ) : (
        <>
          <TuiWindow title="Install">
            <p className="muted" style={{ marginTop: 0 }}>
              1) run <code>{installInitCmd}</code>
              <br />
              2) use Codex CLI normally
              <br />
              3) run <code>{installSyncCmd}</code> (or wait for auto sync)
            </p>
          </TuiWindow>

          <TuiWindow
            title="Query"
            right={<span className="muted">UTC</span>}
          >
            <div className="row">
              <label className="muted">
                From&nbsp;
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="muted">
                To&nbsp;
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button className="btn primary" disabled={loading} onClick={refresh}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              <div className="spacer" />
              <span className="muted">{baseUrl.replace(/^https?:\/\//, '')}</span>
            </div>

            {error ? (
              <div className="muted" style={{ marginTop: 12, color: 'var(--error)' }}>
                Error: {error}
              </div>
            ) : null}
          </TuiWindow>

          <TuiWindow title="Metrics">
            <div className="grid">
              <div className="metric">
                <div className="label">Total</div>
                <div className="value">{toDisplayNumber(summary?.total_tokens)}</div>
              </div>
              <div className="metric">
                <div className="label">Input</div>
                <div className="value">{toDisplayNumber(summary?.input_tokens)}</div>
              </div>
              <div className="metric">
                <div className="label">Output</div>
                <div className="value">{toDisplayNumber(summary?.output_tokens)}</div>
              </div>
              <div className="metric">
                <div className="label">Cached input</div>
                <div className="value">{toDisplayNumber(summary?.cached_input_tokens)}</div>
              </div>
              <div className="metric">
                <div className="label">Reasoning output</div>
                <div className="value">{toDisplayNumber(summary?.reasoning_output_tokens)}</div>
              </div>
            </div>
          </TuiWindow>

          <TuiWindow title="Sparkline">
            <Sparkline rows={sparklineRows} />
          </TuiWindow>

          <TuiWindow title="Daily totals">
            {daily.length === 0 ? (
              <div className="muted">
                No data yet. Use Codex CLI then run <code>{installSyncCmd}</code>.
              </div>
            ) : (
              <div className="tui-table-scroll" role="region" aria-label="Daily totals table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      {DAILY_SORT_COLUMNS.map((c) => (
                        <th key={c.key} aria-sort={ariaSortFor(c.key)}>
                          <button
                            type="button"
                            className="tui-th-btn"
                            onClick={() => toggleSort(c.key)}
                            title={c.title}
                          >
                            {c.label}{' '}
                            <span className={`tui-sort-indicator ${sort.key === c.key ? 'active' : ''}`}>
                              {sortIconFor(c.key)}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDaily.map((r) => (
                      <tr key={String(r.day)}>
                        <td>{String(r.day)}</td>
                        <td>{toDisplayNumber(r.total_tokens)}</td>
                        <td>{toDisplayNumber(r.input_tokens)}</td>
                        <td>{toDisplayNumber(r.output_tokens)}</td>
                        <td>{toDisplayNumber(r.cached_input_tokens)}</td>
                        <td>{toDisplayNumber(r.reasoning_output_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TuiWindow>
        </>
      )}
    </TuiFrame>
  );
}
