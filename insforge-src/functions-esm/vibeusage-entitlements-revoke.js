import { getBearerToken, isProjectAdminBearer } from "./shared/auth.js";
import { createEdgeClient } from "./shared/insforge-client.js";
import { getAnonKey, getBaseUrl, getServiceRoleKey } from "./shared/env.js";
import { handleOptions, json, readJson, requireMethod } from "./shared/http.js";
import { withRequestLogging } from "./shared/logging.js";

export default withRequestLogging("vibeusage-entitlements-revoke", async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "POST");
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get("Authorization"));
  if (!bearer) return json({ error: "Missing bearer token" }, 401);

  const serviceRoleKey = getServiceRoleKey();
  const isServiceRole = Boolean(serviceRoleKey && bearer === serviceRoleKey);
  const isProjectAdmin = isProjectAdminBearer(bearer);
  if (!isServiceRole && !isProjectAdmin) return json({ error: "Unauthorized" }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const data = body.data || {};
  const id = typeof data.id === "string" ? data.id : null;
  const revokedAt = typeof data.revoked_at === "string" ? data.revoked_at : null;

  if (!id) return json({ error: "id is required" }, 400);
  if (revokedAt && !isValidIso(revokedAt)) {
    return json({ error: "revoked_at must be ISO timestamp" }, 400);
  }

  const anonKey = getAnonKey();
  if (!anonKey && !serviceRoleKey) return json({ error: "Admin key missing" }, 500);

  const baseUrl = getBaseUrl();
  const dbClient = await createEdgeClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: isServiceRole ? serviceRoleKey : bearer,
  });

  const nowIso = new Date().toISOString();
  const update = {
    revoked_at: revokedAt || nowIso,
    updated_at: nowIso,
  };

  const { error } = await dbClient.database
    .from("vibeusage_user_entitlements")
    .update(update)
    .eq("id", id);
  if (error) return json({ error: error.message }, 500);

  return json({ id, revoked_at: update.revoked_at }, 200);
});

function isValidIso(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}
