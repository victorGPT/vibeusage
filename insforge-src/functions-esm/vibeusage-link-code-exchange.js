import { createEdgeClient } from "./shared/insforge-client.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, readJson, requireMethod } from "./shared/http.js";
import { sha256Hex } from "./shared/crypto.js";
import { withRequestLogging } from "./shared/logging.js";

const ISSUE_ERROR_MESSAGE = "Link code exchange failed";
const DEVICE_NAME_FALLBACK = "VibeScore CLI";
const PLATFORM_FALLBACK = "macos";

export default withRequestLogging("vibeusage-link-code-exchange", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const linkCode = sanitizeText(body.data?.link_code, 256);
  const requestId = sanitizeText(body.data?.request_id, 128);
  const deviceName = sanitizeText(body.data?.device_name, 128);
  const platform = sanitizeText(body.data?.platform, 32);

  if (!linkCode) return json({ error: "link_code is required" }, 400);
  if (!requestId) return json({ error: "request_id is required" }, 400);

  const baseUrl = getBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: "Missing service role key" }, 500);

  const anonKey = getAnonKey();
  const dbClient = await createEdgeClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey,
  });

  const codeHash = await sha256Hex(linkCode);
  const token = await deriveToken({ secret: serviceRoleKey, codeHash, requestId });
  const tokenHash = await sha256Hex(token);

  const { row: linkRow, error: linkErr } = await fetchLinkCodeRow({ dbClient, codeHash });
  if (linkErr) {
    logIssueError("link code select failed", linkErr?.message || ISSUE_ERROR_MESSAGE);
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }
  if (!linkRow) return json({ error: "invalid link code" }, 400);

  if (linkRow.used_at) {
    if (linkRow.request_id === requestId && typeof linkRow.device_id === "string") {
      return json({ token, device_id: linkRow.device_id, user_id: linkRow.user_id }, 200);
    }
    return json({ error: "link code already used" }, 409);
  }

  if (isExpired(linkRow.expires_at)) {
    return json({ error: "link code expired" }, 400);
  }

  const userId = linkRow.user_id;
  if (typeof userId !== "string" || userId.length === 0) {
    logIssueError("link code missing user_id", ISSUE_ERROR_MESSAGE);
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  const deviceId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { error: deviceErr } = await dbClient.database.from("vibeusage_tracker_devices").insert([
    {
      id: deviceId,
      user_id: userId,
      device_name: deviceName || DEVICE_NAME_FALLBACK,
      platform: platform || PLATFORM_FALLBACK,
    },
  ]);
  if (deviceErr) {
    logIssueError("device insert failed", deviceErr?.message || ISSUE_ERROR_MESSAGE);
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  const { error: tokenErr } = await dbClient.database
    .from("vibeusage_tracker_device_tokens")
    .insert([
      {
        id: tokenId,
        user_id: userId,
        device_id: deviceId,
        token_hash: tokenHash,
      },
    ]);
  if (tokenErr) {
    logIssueError("token insert failed", tokenErr?.message || ISSUE_ERROR_MESSAGE);
    await bestEffortDeleteDevice({ dbClient, deviceId, userId });
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  const { data: updatedRow, error: updateErr } = await dbClient.database
    .from("vibeusage_link_codes")
    .update({ used_at: nowIso, request_id: requestId, device_id: deviceId })
    .eq("id", linkRow.id)
    .is("used_at", null)
    .select("user_id, device_id, request_id")
    .maybeSingle();

  if (updateErr) {
    logIssueError("link code update failed", updateErr?.message || ISSUE_ERROR_MESSAGE);
    await bestEffortDeleteToken({ dbClient, tokenId });
    await bestEffortDeleteDevice({ dbClient, deviceId, userId });
    return json({ error: ISSUE_ERROR_MESSAGE }, 500);
  }

  if (updatedRow && typeof updatedRow.device_id === "string") {
    return json({ token, device_id: updatedRow.device_id, user_id: updatedRow.user_id }, 200);
  }

  await bestEffortDeleteToken({ dbClient, tokenId });
  await bestEffortDeleteDevice({ dbClient, deviceId, userId });

  const { row: freshRow } = await fetchLinkCodeRow({ dbClient, codeHash });
  if (freshRow && freshRow.request_id === requestId && typeof freshRow.device_id === "string") {
    return json({ token, device_id: freshRow.device_id, user_id: freshRow.user_id }, 200);
  }

  return json({ error: "link code already used" }, 409);
});

function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (s.length === 0) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function deriveToken({ secret, codeHash, requestId }) {
  const input = `${secret}:${codeHash}:${requestId}`;
  return sha256Hex(input);
}

async function fetchLinkCodeRow({ dbClient, codeHash }) {
  const { data, error } = await dbClient.database
    .from("vibeusage_link_codes")
    .select("id,user_id,expires_at,used_at,request_id,device_id")
    .eq("code_hash", codeHash)
    .maybeSingle();
  return { row: data || null, error };
}

function isExpired(expiresAt) {
  if (typeof expiresAt !== "string") return true;
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return true;
  return ts <= Date.now();
}

async function bestEffortDeleteToken({ dbClient, tokenId }) {
  try {
    const { error } = await dbClient.database
      .from("vibeusage_tracker_device_tokens")
      .delete()
      .eq("id", tokenId);
    if (error) {
      logIssueError("compensation token delete failed", ISSUE_ERROR_MESSAGE);
    }
  } catch (_err) {
    logIssueError("compensation token delete threw", ISSUE_ERROR_MESSAGE);
  }
}

async function bestEffortDeleteDevice({ dbClient, deviceId, userId }) {
  try {
    let query = dbClient.database.from("vibeusage_tracker_devices").delete().eq("id", deviceId);
    if (userId) query = query.eq("user_id", userId);
    const { error } = await query;
    if (error) {
      logIssueError("compensation device delete failed", ISSUE_ERROR_MESSAGE);
    }
  } catch (_err) {
    logIssueError("compensation device delete threw", ISSUE_ERROR_MESSAGE);
  }
}

function logIssueError(stage, message) {
  console.error(`link code exchange ${stage}: ${message}`);
}
