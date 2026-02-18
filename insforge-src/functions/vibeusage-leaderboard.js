// Edge function: vibeusage-leaderboard
// Returns token usage leaderboard for the current UTC period window for authenticated users.
// Periods:
// - week: current UTC calendar week (Sunday start)
// - month: current UTC calendar month
// - total: all-time

"use strict";

const { handleOptions, json, requireMethod } = require("../shared/http");
const { getBearerToken, getEdgeClientAndUserId } = require("../shared/auth");
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require("../shared/env");
const { toUtcDay, addUtcDays, formatDateUTC } = require("../shared/date");
const { toBigInt, toPositiveInt, toPositiveIntOrNull } = require("../shared/numbers");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10_000;

module.exports = async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);

  const url = new URL(request.url);
  const period = normalizePeriod(url.searchParams.get("period"));
  if (!period) return json({ error: "Invalid period" }, 400);

  const metric = normalizeMetric(url.searchParams.get("metric"));
  if (url.searchParams.has("metric") && !metric) return json({ error: "Invalid metric" }, 400);

  const limit = normalizeLimit(url.searchParams.get("limit"));
  const offset = normalizeOffset(url.searchParams.get("offset"));
  const page = Math.floor(offset / Math.max(1, limit)) + 1;

  let from;
  let to;
  try {
    ({ from, to } = await computeWindow({ period }));
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }

  const serviceRoleKey = getServiceRoleKey();
  const anonKey = getAnonKey();
  const serviceClient = serviceRoleKey
    ? createClient({
        baseUrl,
        anonKey: anonKey || serviceRoleKey,
        edgeFunctionToken: serviceRoleKey,
      })
    : null;

  if (serviceClient) {
    const snapshot = await loadSnapshot({
      serviceClient,
      period,
      metric,
      from,
      to,
      userId: auth.userId,
      limit,
      offset,
    });

    if (snapshot.ok) {
      return json(
        {
          period,
          metric,
          from,
          to,
          generated_at: snapshot.generated_at,
          page,
          limit,
          offset,
          total_entries: snapshot.total_entries,
          total_pages: snapshot.total_pages,
          entries: snapshot.entries,
          me: snapshot.me,
        },
        200,
      );
    }
  }

  const entriesView =
    metric === "all"
      ? `vibeusage_leaderboard_${period}_current`
      : `vibeusage_leaderboard_${metric}_${period}_current`;
  const meView =
    metric === "all"
      ? `vibeusage_leaderboard_me_${period}_current`
      : `vibeusage_leaderboard_me_${metric}_${period}_current`;

  const singleQuery =
    metric === "all"
      ? await tryLoadSingleQuery({
          edgeClient: auth.edgeClient,
          entriesView,
          limit,
          offset,
        })
      : null;

  if (singleQuery) {
    return json(
      {
        period,
        metric,
        from,
        to,
        generated_at: new Date().toISOString(),
        page,
        limit,
        offset,
        total_entries: null,
        total_pages: null,
        entries: singleQuery.entries,
        me: singleQuery.me,
      },
      200,
    );
  }

  const { data: rawEntries, error: entriesErr } = await auth.edgeClient.database
    .from(entriesView)
    .select("rank,is_me,display_name,avatar_url,gpt_tokens,claude_tokens,other_tokens,total_tokens")
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (entriesErr) return json({ error: entriesErr.message }, 500);

  const { data: rawMe, error: meErr } = await auth.edgeClient.database
    .from(meView)
    .select("rank,gpt_tokens,claude_tokens,other_tokens,total_tokens")
    .maybeSingle();

  if (meErr) return json({ error: meErr.message }, 500);

  const entries = (rawEntries || []).slice(0, limit).map(normalizeEntry);
  const me = normalizeMe(rawMe);

  return json(
    {
      period,
      metric,
      from,
      to,
      generated_at: new Date().toISOString(),
      page,
      limit,
      offset,
      total_entries: null,
      total_pages: null,
      entries,
      me,
    },
    200,
  );
};

function toSafeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function tryLoadSingleQuery({ edgeClient, entriesView, limit, offset }) {
  try {
    const startRank = offset + 1;
    const endRank = offset + limit;
    const { data, error } = await edgeClient.database
      .from(entriesView)
      .select(
        "rank,is_me,display_name,avatar_url,gpt_tokens,claude_tokens,other_tokens,total_tokens,is_public",
      )
      .or(`and(rank.gte.${startRank},rank.lte.${endRank}),is_me.eq.true`)
      .order("rank", { ascending: true });

    if (error) return null;

    const rows = Array.isArray(data) ? data : [];
    const entries = [];

    for (const row of rows) {
      const rank = toPositiveInt(row?.rank);
      if (rank < startRank || rank > endRank) continue;
      entries.push(normalizeEntry(row));
    }

    const meRow = rows.find((row) => Boolean(row?.is_me));
    const me = normalizeMe(meRow);

    return { entries: entries.slice(0, limit), me };
  } catch (_e) {
    return null;
  }
}

function normalizePeriod(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

function normalizeMetric(raw) {
  if (typeof raw !== "string") return "all";
  const v = raw.trim().toLowerCase();
  if (!v) return "all";
  if (v === "all") return v;
  if (v === "gpt") return v;
  if (v === "claude") return v;
  if (v === "other") return v;
  return null;
}

function normalizeLimit(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const i = Math.floor(n);
  if (i < 1) return 1;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

function normalizeOffset(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_OFFSET;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_OFFSET;
  const i = Math.floor(n);
  if (i < 0) return 0;
  if (i > MAX_OFFSET) return MAX_OFFSET;
  return i;
}

function applyMetricFilter(query, metric) {
  if (!query) return query;
  if (metric === "gpt") return query.gt("gpt_tokens", 0);
  if (metric === "claude") return query.gt("claude_tokens", 0);
  if (metric === "other") return query.gt("other_tokens", 0);
  return query;
}

function resolveRankColumn(metric) {
  if (metric === "gpt") return "rank_gpt";
  if (metric === "claude") return "rank_claude";
  if (metric === "other") return "rank_other";
  return "rank";
}

async function loadSnapshot({ serviceClient, period, metric, from, to, userId, limit, offset }) {
  const rankColumn = resolveRankColumn(metric);

  const countQuery = applyMetricFilter(
    serviceClient.database
      .from("vibeusage_leaderboard_snapshots")
      .select("user_id", { count: "exact" })
      .eq("period", period)
      .eq("from_day", from)
      .eq("to_day", to),
    metric,
  );

  const countRes = await countQuery.limit(1);

  if (countRes.error) {
    console.error("snapshot count error", countRes.error);
    return { ok: false };
  }

  const totalEntries = toSafeCount(countRes.count);
  const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / Math.max(1, limit)) : 0;

  const entriesQuery = applyMetricFilter(
    serviceClient.database
      .from("vibeusage_leaderboard_snapshots")
      .select(
        "user_id,rank,rank_gpt,rank_claude,rank_other,gpt_tokens,claude_tokens,other_tokens,total_tokens,display_name,avatar_url,is_public,generated_at",
      )
      .eq("period", period)
      .eq("from_day", from)
      .eq("to_day", to),
    metric,
  );

  const { data: entryRows, error: entriesErr } = await entriesQuery
    .order(rankColumn, { ascending: true })
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (entriesErr) {
    console.error("snapshot entries error", entriesErr);
    return { ok: false };
  }

  const { data: meRow, error: meErr } = await serviceClient.database
    .from("vibeusage_leaderboard_snapshots")
    .select(
      "rank,rank_gpt,rank_claude,rank_other,gpt_tokens,claude_tokens,other_tokens,total_tokens,generated_at",
    )
    .eq("period", period)
    .eq("from_day", from)
    .eq("to_day", to)
    .eq("user_id", userId)
    .maybeSingle();

  if (meErr) {
    console.error("snapshot me error", meErr);
    return { ok: false };
  }

  const entries = (entryRows || []).map((row) => {
    const displayName = normalizeDisplayName(row?.display_name);
    const avatarUrl = normalizeAvatarUrl(row?.avatar_url);
    const rawUserId = typeof row?.user_id === "string" ? row.user_id : null;
    const isPublic = Boolean(row?.is_public);

    // Only expose user_id when is_public=true.
    // Public name/avatar and stable id exposure are controlled independently.
    const exposedUserId = isPublic ? rawUserId : null;

    const gptTokens = toBigInt(row?.gpt_tokens);
    const claudeTokens = toBigInt(row?.claude_tokens);
    const totalTokens = toBigInt(row?.total_tokens);
    const otherTokens = resolveOtherTokens({
      row,
      totalTokens,
      gptTokens,
      claudeTokens,
    });

    const metricRank = toPositiveInt(row?.[rankColumn]);
    const resolvedRank = metricRank > 0 ? metricRank : toPositiveInt(row?.rank);

    return {
      user_id: exposedUserId,
      rank: resolvedRank,
      is_me: rawUserId === userId,
      display_name: displayName,
      avatar_url: avatarUrl,
      gpt_tokens: gptTokens.toString(),
      claude_tokens: claudeTokens.toString(),
      other_tokens: otherTokens.toString(),
      total_tokens: totalTokens.toString(),
      is_public: isPublic,
    };
  });

  const me = normalizeMetricMe(meRow, metric);
  const generatedAt = normalizeGeneratedAt(entryRows, meRow);

  if (entries.length === 0 && !meRow) return { ok: false };

  return {
    ok: true,
    total_entries: totalEntries,
    total_pages: totalPages,
    entries,
    me,
    generated_at: generatedAt,
  };
}

function normalizeMetricMe(row, metric) {
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveOtherTokens({
    row,
    totalTokens,
    gptTokens,
    claudeTokens,
  });

  let rank = toPositiveIntOrNull(row?.rank);
  if (metric === "gpt") {
    rank = gptTokens > 0n ? toPositiveIntOrNull(row?.rank_gpt) : null;
  } else if (metric === "claude") {
    rank = claudeTokens > 0n ? toPositiveIntOrNull(row?.rank_claude) : null;
  } else if (metric === "other") {
    const rankOther = toPositiveIntOrNull(row?.rank_other);
    rank = otherTokens > 0n ? (rankOther ?? toPositiveIntOrNull(row?.rank)) : null;
  }

  return {
    rank,
    gpt_tokens: gptTokens.toString(),
    claude_tokens: claudeTokens.toString(),
    other_tokens: otherTokens.toString(),
    total_tokens: totalTokens.toString(),
  };
}

async function computeWindow({ period }) {
  const now = new Date();
  const today = toUtcDay(now);

  if (period === "week") {
    const dow = today.getUTCDay(); // 0=Sunday
    const from = addUtcDays(today, -dow);
    const to = addUtcDays(from, 6);
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === "month") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === "total") {
    // Represent all-time as an open-ended UTC date range.
    return { from: "1970-01-01", to: "9999-12-31" };
  }

  throw new Error(`Unsupported period: ${String(period)}`);
}

function normalizeEntry(row) {
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveOtherTokens({
    row,
    totalTokens,
    gptTokens,
    claudeTokens,
  });

  return {
    user_id: null,
    rank: toPositiveInt(row?.rank),
    is_me: Boolean(row?.is_me),
    display_name: normalizeDisplayName(row?.display_name),
    avatar_url: normalizeAvatarUrl(row?.avatar_url),
    gpt_tokens: gptTokens.toString(),
    claude_tokens: claudeTokens.toString(),
    other_tokens: otherTokens.toString(),
    total_tokens: totalTokens.toString(),
    is_public: Boolean(row?.is_public),
  };
}

function normalizeMe(row) {
  const rank = toPositiveIntOrNull(row?.rank);
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveOtherTokens({
    row,
    totalTokens,
    gptTokens,
    claudeTokens,
  });
  return {
    rank,
    gpt_tokens: gptTokens.toString(),
    claude_tokens: claudeTokens.toString(),
    other_tokens: otherTokens.toString(),
    total_tokens: totalTokens.toString(),
  };
}

function resolveOtherTokens({ row, totalTokens, gptTokens, claudeTokens }) {
  const explicit = row?.other_tokens;
  if (explicit != null) return toBigInt(explicit);

  const derived = totalTokens - gptTokens - claudeTokens;
  return derived > 0n ? derived : 0n;
}

function normalizeGeneratedAt(entryRows, meRow) {
  const candidate = entryRows?.[0]?.generated_at || meRow?.generated_at;
  if (candidate && typeof candidate === "string") {
    const dt = new Date(candidate);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  return new Date().toISOString();
}

function normalizeDisplayName(value) {
  if (typeof value !== "string") return "Anonymous";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Anonymous";
}

function normalizeAvatarUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
