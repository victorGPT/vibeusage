// Edge function: vibeusage-leaderboard-settings
// Updates the current user's leaderboard privacy setting.

"use strict";

const { handleOptions, json, readJson } = require("../shared/http");
const { getBearerToken, getEdgeClientAndUserId } = require("../shared/auth");
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require("../shared/env");
const { toUtcDay, addUtcDays, formatDateUTC } = require("../shared/date");

module.exports = async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);

  if (request.method === "GET") {
    const { data, error } = await auth.edgeClient.database
      .from("vibeusage_user_settings")
      .select("leaderboard_public,updated_at")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    return json(
      {
        leaderboard_public: Boolean(data?.leaderboard_public),
        updated_at: typeof data?.updated_at === "string" ? data.updated_at : null,
      },
      200,
    );
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const leaderboardPublic = body.data?.leaderboard_public;
  if (typeof leaderboardPublic !== "boolean") {
    return json({ error: "leaderboard_public must be boolean" }, 400);
  }

  const updatedAt = new Date().toISOString();
  const upsertRow = {
    user_id: auth.userId,
    leaderboard_public: leaderboardPublic,
    updated_at: updatedAt,
  };

  const settingsTable = auth.edgeClient.database.from("vibeusage_user_settings");
  if (typeof settingsTable.upsert === "function") {
    try {
      const { error: upsertErr } = await settingsTable.upsert([upsertRow], {
        onConflict: "user_id",
      });
      if (!upsertErr) {
        await trySyncPublicView({
          edgeClient: auth.edgeClient,
          userId: auth.userId,
          leaderboardPublic,
          updatedAt,
        });
        await trySyncSnapshot({ baseUrl, userId: auth.userId, leaderboardPublic });
        return json({ leaderboard_public: leaderboardPublic, updated_at: updatedAt }, 200);
      }
    } catch (_err) {
      // Fall back to legacy select → update/insert when upsert is unavailable.
    }
  }

  const { data: existing, error: selErr } = await auth.edgeClient.database
    .from("vibeusage_user_settings")
    .select("user_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (selErr) return json({ error: selErr.message }, 500);

  if (existing?.user_id) {
    const { error: updErr } = await auth.edgeClient.database
      .from("vibeusage_user_settings")
      .update({ leaderboard_public: leaderboardPublic, updated_at: updatedAt })
      .eq("user_id", auth.userId);
    if (updErr) return json({ error: updErr.message }, 500);
  } else {
    const { error: insErr } = await auth.edgeClient.database
      .from("vibeusage_user_settings")
      .insert([upsertRow]);
    if (insErr) return json({ error: insErr.message }, 500);
  }

  await trySyncPublicView({
    edgeClient: auth.edgeClient,
    userId: auth.userId,
    leaderboardPublic,
    updatedAt,
  });
  await trySyncSnapshot({ baseUrl, userId: auth.userId, leaderboardPublic });
  return json({ leaderboard_public: leaderboardPublic, updated_at: updatedAt }, 200);
};

async function trySyncPublicView({ edgeClient, userId, leaderboardPublic, updatedAt }) {
  if (leaderboardPublic) return;
  try {
    await edgeClient.database
      .from("vibeusage_public_views")
      .update({ revoked_at: updatedAt, updated_at: updatedAt })
      .eq("user_id", userId);
  } catch (_err) {
    // ignore revoke errors
  }
}

async function trySyncSnapshot({ baseUrl, userId, leaderboardPublic }) {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return;

  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  const windows = computeWindows();

  let profileRow = null;
  try {
    const { data } = await serviceClient.database
      .from("users")
      .select("nickname,avatar_url,profile,metadata")
      .eq("id", userId)
      .maybeSingle();
    profileRow = data || null;
  } catch (_err) {
    profileRow = null;
  }

  const hasActivePublicLink = leaderboardPublic
    ? await loadHasActivePublicLink({ serviceClient, userId })
    : false;
  const isPublic = leaderboardPublic && hasActivePublicLink;

  const resolvedDisplayName = resolveDisplayName(profileRow);
  const resolvedAvatarUrl = resolveAvatarUrl(profileRow);

  const displayName = isPublic ? resolvedDisplayName || "Anonymous" : "Anonymous";
  const nextAvatarUrl = isPublic ? resolvedAvatarUrl : null;

  for (const w of windows) {
    try {
      await serviceClient.database
        .from("vibeusage_leaderboard_snapshots")
        .update({ display_name: displayName, avatar_url: nextAvatarUrl, is_public: isPublic })
        .eq("period", w.period)
        .eq("from_day", w.from)
        .eq("to_day", w.to)
        .eq("user_id", userId);
    } catch (_err) {
      // ignore sync errors
    }
  }
}

async function loadHasActivePublicLink({ serviceClient, userId }) {
  try {
    const { data, error } = await serviceClient.database
      .from("vibeusage_public_views")
      .select("user_id")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return false;
    return typeof data?.user_id === "string";
  } catch (_err) {
    return false;
  }
}

function computeWindows() {
  const now = new Date();
  const today = toUtcDay(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  const dow = today.getUTCDay(); // 0=Sunday
  const weekFrom = formatDateUTC(addUtcDays(today, -dow));
  const weekTo = formatDateUTC(addUtcDays(today, -dow + 6));

  const monthFrom = formatDateUTC(new Date(Date.UTC(year, month, 1)));
  const monthTo = formatDateUTC(new Date(Date.UTC(year, month + 1, 0)));

  const totalFrom = "1970-01-01";
  const totalTo = "9999-12-31";

  return [
    { period: "week", from: weekFrom, to: weekTo },
    { period: "month", from: monthFrom, to: monthTo },
    { period: "total", from: totalFrom, to: totalTo },
  ];
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

function isObject(value) {
  return Boolean(value && typeof value === "object");
}
