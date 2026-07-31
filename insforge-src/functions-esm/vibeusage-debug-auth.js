import { getBearerToken, verifyUserJwt } from "./shared/auth.js";
import { getAnonKey } from "./shared/env.js";
import { handleOptions, json, requireMethod } from "./shared/http.js";

export default async function (request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, "GET");
  if (methodErr) return methodErr;

  const anonKey = getAnonKey();
  const bearer = getBearerToken(request.headers.get("Authorization"));

  if (!anonKey) {
    return json(
      {
        hasAnonKey: false,
        hasBearer: Boolean(bearer),
        authOk: false,
        userId: null,
        error: "Missing anon key",
      },
      200,
    );
  }

  if (!bearer) {
    return json(
      {
        hasAnonKey: true,
        hasBearer: false,
        authOk: false,
        userId: null,
        error: "Missing bearer token",
      },
      200,
    );
  }

  const local = await verifyUserJwt({ token: bearer });
  return json(
    {
      hasAnonKey: true,
      hasBearer: true,
      authOk: local.ok,
      userId: local.userId,
      error: local.ok ? null : local.error || "Unauthorized",
    },
    200,
  );
}
