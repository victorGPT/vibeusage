// Edge function: vibeusage-leaderboard-profile
// Returns the requested user's leaderboard snapshot row for the requested period when it is public (or self).

"use strict";

const { handleOptions, json, requireMethod } = require("../shared/http");
const { getBearerToken, getEdgeClientAndUserId } = require("../shared/auth");
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require("../shared/env");
const { toUtcDay, addUtcDays, formatDateUTC } = require("../shared/date");
const { toBigInt, toPositiveIntOrNull } = require("../shared/numbers");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  const period = normalizePeriod(url.searchParams.get("period")) || "week";
  const requestedUserId = normalizeUserId(url.searchParams.get("user_id"));
  if (!requestedUserId) return json({ error: "user_id is required" }, 400);

  const { from, to } = computeWindow({ period });

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: "Service unavailable" }, 503);

  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  const isSelf = requestedUserId === auth.userId;
  if (!isSelf) {
    const { data: settings, error: settingsErr } = await serviceClient.database
      .from("vibeusage_user_settings")
      .select("leaderboard_public")
      .eq("user_id", requestedUserId)
      .maybeSingle();

    if (settingsErr) return json({ error: "Failed to resolve leaderboard settings" }, 500);
    if (!settings?.leaderboard_public) return json({ error: "Not found" }, 404);

    const { data: activeLink, error: activeLinkErr } = await serviceClient.database
      .from("vibeusage_public_views")
      .select("user_id")
      .eq("user_id", requestedUserId)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();

    if (activeLinkErr) return json({ error: "Failed to resolve public share state" }, 500);
    if (!activeLink?.user_id) return json({ error: "Not found" }, 404);
  }

  const { data: snapshot, error: snapshotErr } = await serviceClient.database
    .from("vibeusage_leaderboard_snapshots")
    .select(
      "user_id,display_name,avatar_url,rank,gpt_tokens,claude_tokens,other_tokens,total_tokens,is_public,generated_at",
    )
    .eq("period", period)
    .eq("from_day", from)
    .eq("to_day", to)
    .eq("user_id", requestedUserId)
    .maybeSingle();

  if (snapshotErr)
    return json({ error: snapshotErr.message || "Failed to fetch leaderboard snapshot" }, 500);
  if (!snapshot) return json({ error: "Not found" }, 404);
  if (!isSelf && snapshot.is_public !== true) return json({ error: "Not found" }, 404);

  return json(
    {
      period,
      from,
      to,
      generated_at: normalizeGeneratedAt(snapshot.generated_at),
      entry: normalizeSnapshotEntry(snapshot),
    },
    200,
  );
};

function normalizePeriod(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

function normalizeUserId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

function computeWindow({ period }) {
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
    return { from: "1970-01-01", to: "9999-12-31" };
  }

  return computeWindow({ period: "week" });
}

function normalizeGeneratedAt(value) {
  if (typeof value !== "string") return new Date().toISOString();
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

function normalizeSnapshotEntry(row) {
  const displayName = normalizeDisplayName(row?.display_name);
  const avatarUrl = normalizeAvatarUrl(row?.avatar_url);
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
    user_id: typeof row?.user_id === "string" ? row.user_id : null,
    display_name: displayName,
    avatar_url: avatarUrl,
    rank: toPositiveIntOrNull(row?.rank),
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
