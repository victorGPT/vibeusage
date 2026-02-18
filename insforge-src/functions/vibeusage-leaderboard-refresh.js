// Edge function: vibeusage-leaderboard-refresh
// Rebuilds leaderboard snapshots for current UTC period window.
// Auth: Authorization: Bearer <service_role_key>

"use strict";

const { handleOptions, json, requireMethod } = require("../shared/http");
const { getBearerToken } = require("../shared/auth");
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require("../shared/env");
const { toUtcDay, addUtcDays, formatDateUTC } = require("../shared/date");
const { forEachPage } = require("../shared/pagination");
const { toBigInt, toPositiveInt } = require("../shared/numbers");

const PERIODS = ["week", "month"];
const SOURCE_PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;

module.exports = async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: "Admin key missing" }, 500);

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const requested = normalizePeriod(url.searchParams.get("period"));
  if (url.searchParams.has("period") && !requested) return json({ error: "Invalid period" }, 400);

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  const targetPeriods = requested ? [requested] : PERIODS;
  const generatedAt = new Date().toISOString();
  const results = [];

  try {
    for (const period of targetPeriods) {
      const window = await computeWindow({ period });
      if (!window.ok) return json({ error: window.error }, 500);

      const { from, to } = window;
      const { inserted } = await refreshPeriod({
        serviceClient,
        period,
        from,
        to,
        generatedAt,
      });

      results.push({ period, from, to, inserted });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }

  return json({ success: true, generated_at: generatedAt, results }, 200);
};

function normalizePeriod(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "week") return v;
  if (v === "month") return v;
  if (v === "total") return v;
  return null;
}

async function computeWindow({ period }) {
  const now = new Date();
  const today = toUtcDay(now);

  if (period === "week") {
    const dow = today.getUTCDay();
    const from = addUtcDays(today, -dow);
    const to = addUtcDays(from, 6);
    return { ok: true, from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === "month") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { ok: true, from: formatDateUTC(from), to: formatDateUTC(to) };
  }

  if (period === "total") {
    return { ok: true, from: "1970-01-01", to: "9999-12-31" };
  }

  return { ok: false, error: `Invalid period: ${String(period)}` };
}

async function refreshPeriod({ serviceClient, period, from, to, generatedAt }) {
  const deleteRes = await serviceClient.database
    .from("vibeusage_leaderboard_snapshots")
    .delete()
    .eq("period", period)
    .eq("from_day", from)
    .eq("to_day", to);

  if (deleteRes.error) {
    throw new Error(deleteRes.error.message);
  }

  const sourceView = `vibeusage_leaderboard_source_${period}`;
  let inserted = 0;

  const { error } = await forEachPage({
    pageSize: SOURCE_PAGE_SIZE,
    createQuery: () =>
      serviceClient.database
        .from(sourceView)
        .select(
          "user_id,rank,rank_gpt,rank_claude,rank_other,gpt_tokens,claude_tokens,other_tokens,total_tokens,display_name,avatar_url",
        )
        .order("rank", { ascending: true }),
    onPage: async (rows) => {
      const profileByUserId = await loadPublicProfileLookup({
        serviceClient,
        userIds: (rows || []).map((row) => row?.user_id),
      });

      const normalized = (rows || [])
        .map((row) =>
          normalizeSnapshotRow({
            row,
            period,
            from,
            to,
            generatedAt,
            publicProfile: profileByUserId.get(row?.user_id),
          }),
        )
        .filter(Boolean);

      for (const batch of chunkRows(normalized, INSERT_BATCH_SIZE)) {
        const { error: insertErr } = await serviceClient.database
          .from("vibeusage_leaderboard_snapshots")
          .insert(batch);
        if (insertErr) throw new Error(insertErr.message);
      }

      inserted += normalized.length;
    },
  });

  if (error) throw new Error(error.message);
  return { inserted };
}

async function loadPublicProfileLookup({ serviceClient, userIds }) {
  const uniqueUserIds = Array.from(
    new Set(
      (userIds || []).filter((value) => typeof value === "string" && value.trim().length > 0),
    ),
  );

  const lookup = new Map();
  if (uniqueUserIds.length === 0) return lookup;

  try {
    const [settingsRes, usersRes, publicViewsRes] = await Promise.all([
      serviceClient.database
        .from("vibeusage_user_settings")
        .select("user_id,leaderboard_public")
        .in("user_id", uniqueUserIds),
      serviceClient.database
        .from("users")
        .select("id,nickname,avatar_url,profile,metadata")
        .in("id", uniqueUserIds),
      serviceClient.database
        .from("vibeusage_public_views")
        .select("user_id")
        .in("user_id", uniqueUserIds)
        .is("revoked_at", null),
    ]);

    if (settingsRes?.error || usersRes?.error || publicViewsRes?.error) {
      return lookup;
    }

    const settingsMap = new Map();
    for (const row of settingsRes.data || []) {
      if (typeof row?.user_id !== "string") continue;
      settingsMap.set(row.user_id, Boolean(row?.leaderboard_public));
    }

    const usersMap = new Map();
    for (const row of usersRes.data || []) {
      if (typeof row?.id !== "string") continue;
      usersMap.set(row.id, row);
    }

    const hasActiveLink = new Set();
    for (const row of publicViewsRes.data || []) {
      if (typeof row?.user_id === "string") {
        hasActiveLink.add(row.user_id);
      }
    }

    for (const userId of uniqueUserIds) {
      const row = usersMap.get(userId) || null;
      const leaderboardPublic = settingsMap.get(userId) === true;
      const hasLink = hasActiveLink.has(userId);
      // isPublic only true when BOTH leaderboard_public=true AND has active public link
      const isPublic = leaderboardPublic && hasLink;
      const displayName = isPublic ? resolveDisplayName(row) : null;
      const avatarUrl = isPublic ? resolveAvatarUrl(row) : null;

      lookup.set(userId, {
        isPublic,
        displayName: displayName || null,
        avatarUrl: avatarUrl || null,
      });
    }
  } catch (_err) {
    return lookup;
  }

  return lookup;
}

function normalizeSnapshotRow({ row, period, from, to, generatedAt, publicProfile = null }) {
  if (!row?.user_id) return null;
  const rank = toPositiveInt(row.rank);
  if (rank <= 0) return null;
  const rankGpt = toPositiveInt(row.rank_gpt);
  const rankClaude = toPositiveInt(row.rank_claude);
  const rankOtherRaw = toPositiveInt(row.rank_other);
  const rankOther = rankOtherRaw > 0 ? rankOtherRaw : rank;
  if (rankGpt <= 0) return null;
  if (rankClaude <= 0) return null;

  const gptTokensBigInt = toBigInt(row.gpt_tokens);
  const claudeTokensBigInt = toBigInt(row.claude_tokens);
  const totalTokensBigInt = toBigInt(row.total_tokens);
  const otherTokensBigInt = resolveOtherTokens({
    row,
    totalTokens: totalTokensBigInt,
    gptTokens: gptTokensBigInt,
    claudeTokens: claudeTokensBigInt,
  });

  const gptTokens = gptTokensBigInt.toString();
  const claudeTokens = claudeTokensBigInt.toString();
  const otherTokens = otherTokensBigInt.toString();
  const totalTokens = totalTokensBigInt.toString();

  const fallbackDisplayName = normalizeDisplayName(row.display_name);
  const fallbackAvatarUrl = normalizeAvatarUrl(row.avatar_url);
  const displayName = publicProfile
    ? publicProfile.isPublic
      ? publicProfile.displayName || "Anonymous"
      : "Anonymous"
    : fallbackDisplayName;
  const avatarUrl = publicProfile
    ? publicProfile.isPublic
      ? publicProfile.avatarUrl || null
      : null
    : fallbackAvatarUrl;
  const isPublic = publicProfile?.isPublic || false;

  return {
    period,
    from_day: from,
    to_day: to,
    user_id: row.user_id,
    rank,
    rank_gpt: rankGpt,
    rank_claude: rankClaude,
    rank_other: rankOther,
    gpt_tokens: gptTokens,
    claude_tokens: claudeTokens,
    other_tokens: otherTokens,
    total_tokens: totalTokens,
    display_name: displayName,
    avatar_url: avatarUrl,
    is_public: isPublic,
    generated_at: generatedAt,
  };
}

function resolveOtherTokens({ row, totalTokens, gptTokens, claudeTokens }) {
  const explicit = row?.other_tokens;
  if (explicit != null) return toBigInt(explicit);

  const derived = totalTokens - gptTokens - claudeTokens;
  return derived > 0n ? derived : 0n;
}

function resolveDisplayName(row) {
  const profile = isObject(row?.profile) ? row.profile : null;
  const metadata = isObject(row?.metadata) ? row.metadata : null;

  return (
    sanitizeName(row?.nickname) ||
    sanitizeName(profile?.name) ||
    sanitizeName(profile?.full_name) ||
    sanitizeName(metadata?.full_name) ||
    sanitizeName(metadata?.name) ||
    null
  );
}

function resolveAvatarUrl(row) {
  const profile = isObject(row?.profile) ? row.profile : null;
  const metadata = isObject(row?.metadata) ? row.metadata : null;

  return (
    sanitizeAvatarUrl(row?.avatar_url) ||
    sanitizeAvatarUrl(profile?.avatar_url) ||
    sanitizeAvatarUrl(metadata?.avatar_url) ||
    sanitizeAvatarUrl(metadata?.picture) ||
    null
  );
}

function sanitizeName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  if (trimmed.length > 128) return trimmed.slice(0, 128);
  return trimmed;
}

function sanitizeAvatarUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 1024) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch (_e) {
    return null;
  }
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

function isObject(value) {
  return Boolean(value && typeof value === "object");
}

function chunkRows(rows, size) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
