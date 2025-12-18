// Edge function: vibescore-usage-heatmap
// Returns a GitHub-inspired activity heatmap derived from UTC daily token usage.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

module.exports = async function (request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const url = new URL(request.url);

  const weeksRaw = url.searchParams.get("weeks");
  const weeks = normalizeWeeks(weeksRaw);
  if (!weeks) return json({ error: "Invalid weeks" }, 400);

  const weekStartsOnRaw = url.searchParams.get("week_starts_on");
  const weekStartsOn = normalizeWeekStartsOn(weekStartsOnRaw);
  if (!weekStartsOn) return json({ error: "Invalid week_starts_on" }, 400);

  const toRaw = url.searchParams.get("to");
  const to = normalizeToDate(toRaw);
  if (!to) return json({ error: "Invalid to" }, 400);

  const { from, gridStart, end } = computeHeatmapWindowUtc({
    weeks,
    weekStartsOn,
    to,
  });

  const baseUrl =
    Deno.env.get("INSFORGE_INTERNAL_URL") || "http://insforge:7130";
  const edgeClient = createClient({ baseUrl, edgeFunctionToken: bearer });

  const { data: userData, error: userErr } =
    await edgeClient.auth.getCurrentUser();
  const userId = userData?.user?.id;
  if (userErr || !userId) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await edgeClient.database
    .from("vibescore_tracker_daily")
    .select("day,total_tokens")
    .eq("user_id", userId)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (error) return json({ error: error.message }, 500);

  const valuesByDay = new Map();
  for (const row of Array.isArray(data) ? data : []) {
    const day = typeof row?.day === "string" ? row.day : null;
    if (!day) continue;
    valuesByDay.set(day, toBigInt(row?.total_tokens));
  }

  const nz = [];
  let activeDays = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const dt = addUtcDays(gridStart, i);
    if (dt.getTime() > end.getTime()) break;
    const value = valuesByDay.get(formatDateUTC(dt)) || 0n;
    if (value > 0n) {
      activeDays += 1;
      nz.push(value);
    }
  }

  nz.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const t1 = quantileNearestRank(nz, 0.5);
  const t2 = quantileNearestRank(nz, 0.75);
  const t3 = quantileNearestRank(nz, 0.9);

  const levelFor = (value) => {
    if (!value || value <= 0n) return 0;
    if (value <= t1) return 1;
    if (value <= t2) return 2;
    if (value <= t3) return 3;
    return 4;
  };

  const weeksOut = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = addUtcDays(gridStart, w * 7 + d);
      if (dt.getTime() > end.getTime()) {
        week.push(null);
        continue;
      }
      const day = formatDateUTC(dt);
      const value = valuesByDay.get(day) || 0n;
      week.push({ day, value: value.toString(), level: levelFor(value) });
    }
    weeksOut.push(week);
  }

  const streakDays = computeActiveStreakDays({
    valuesByDay,
    to: end,
  });

  return json(
    {
      from,
      to,
      week_starts_on: weekStartsOn,
      thresholds: { t1: t1.toString(), t2: t2.toString(), t3: t3.toString() },
      active_days: activeDays,
      streak_days: streakDays,
      weeks: weeksOut,
    },
    200
  );
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(headerValue) {
  if (!headerValue) return null;
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function normalizeWeeks(raw) {
  if (raw == null || raw === "") return 52;
  const s = String(raw).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  if (v < 1 || v > 104) return null;
  return v;
}

function normalizeWeekStartsOn(raw) {
  const v = (raw == null || raw === "" ? "sun" : String(raw)).trim().toLowerCase();
  if (v === "sun" || v === "mon") return v;
  return null;
}

function normalizeToDate(raw) {
  if (raw == null || raw === "") return formatDateUTC(new Date());
  const s = String(raw).trim();
  const dt = parseUtcDateString(s);
  return dt ? formatDateUTC(dt) : null;
}

function isDate(s) {
  return typeof s === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

function formatDateUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function parseUtcDateString(yyyyMmDd) {
  if (!isDate(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return formatDateUTC(dt) === yyyyMmDd ? dt : null;
}

function addUtcDays(date, days) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function computeHeatmapWindowUtc({ weeks, weekStartsOn, to }) {
  const end = parseUtcDateString(to) || new Date();
  const desired = weekStartsOn === "mon" ? 1 : 0;
  const endDow = end.getUTCDay();
  const endWeekStart = addUtcDays(end, -((endDow - desired + 7) % 7));
  const gridStart = addUtcDays(endWeekStart, -7 * (weeks - 1));
  return { from: formatDateUTC(gridStart), gridStart, end };
}

function toBigInt(v) {
  if (typeof v === "bigint") return v >= 0n ? v : 0n;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return 0n;
    return BigInt(Math.floor(v));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!/^[0-9]+$/.test(s)) return 0n;
    try {
      return BigInt(s);
    } catch (_e) {
      return 0n;
    }
  }
  return 0n;
}

function quantileNearestRank(sortedBigints, q) {
  if (!Array.isArray(sortedBigints) || sortedBigints.length === 0) return 0n;
  const n = sortedBigints.length;
  const pos = Math.floor((n - 1) * q);
  const idx = Math.min(n - 1, Math.max(0, pos));
  return sortedBigints[idx] || 0n;
}

function computeActiveStreakDays({ valuesByDay, to }) {
  let streak = 0;
  for (let i = 0; i < 370; i++) {
    const key = formatDateUTC(addUtcDays(to, -i));
    const value = valuesByDay.get(key) || 0n;
    if (value > 0n) streak += 1;
    else break;
  }
  return streak;
}
