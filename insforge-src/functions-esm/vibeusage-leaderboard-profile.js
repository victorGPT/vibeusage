import { getBearerToken, getEdgeClientAndUserId } from "./shared/auth.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, requireMethod } from "./shared/http.js";
import { toBigInt, toPositiveIntOrNull } from "./shared/numbers.js";
import "../shared/user-identity-core.mjs";
import "../shared/leaderboard-core.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const leaderboardCore = globalThis.__vibeusageLeaderboardCore;
if (!leaderboardCore) throw new Error("leaderboard core not initialized");
const {
  normalizeLeaderboardPeriod,
  computeLeaderboardWindow,
  resolveLeaderboardOtherTokens,
  normalizeLeaderboardDisplayName,
  normalizeLeaderboardAvatarUrl,
  normalizeLeaderboardGeneratedAt,
} = leaderboardCore;

export default async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  const baseUrl = getBaseUrl();

  let auth = { ok: false, edgeClient: null, userId: null };
  if (bearer) {
    auth = await getEdgeClientAndUserId({ baseUrl, bearer });
    if (!auth.ok) return json({ error: auth.error || "Unauthorized" }, auth.status || 401);
  }

  const viewerUserId = auth.ok ? auth.userId : null;

  const url = new URL(request.url);
  const period = normalizeLeaderboardPeriod(url.searchParams.get("period")) || "week";
  const requestedUserId = normalizeUserId(url.searchParams.get("user_id"));
  if (!requestedUserId) return json({ error: "user_id is required" }, 400);

  const { from, to } = computeLeaderboardWindow({ period });

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: "Service unavailable" }, 503);

  const anonKey = getAnonKey();
  const serviceClient = await createEdgeClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  const isSelf = viewerUserId ? requestedUserId === viewerUserId : false;

  if (!isSelf) {
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
      generated_at: normalizeLeaderboardGeneratedAt(snapshot.generated_at),
      entry: normalizeSnapshotEntry(snapshot),
    },
    200,
  );
};

function normalizeUserId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizeSnapshotEntry(row) {
  const displayName = normalizeLeaderboardDisplayName(row?.display_name);
  const avatarUrl = normalizeLeaderboardAvatarUrl(row?.avatar_url);
  const gptTokens = toBigInt(row?.gpt_tokens);
  const claudeTokens = toBigInt(row?.claude_tokens);
  const totalTokens = toBigInt(row?.total_tokens);
  const otherTokens = resolveLeaderboardOtherTokens({
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
