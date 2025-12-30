const assert = require("node:assert/strict");
const { test } = require("node:test");

const { beginBrowserAuth } = require("../src/lib/browser-auth");

test("browser auth callback redirects to dashboard when available", async () => {
  const dashboardUrl = "http://127.0.0.1:9999";
  const { authUrl, waitForCallback } = await beginBrowserAuth({
    baseUrl: "https://example.invalid",
    dashboardUrl,
    timeoutMs: 2000,
    open: false,
  });

  const auth = new URL(authUrl);
  const redirectParam = auth.searchParams.get("redirect");
  assert.ok(redirectParam, "expected redirect param on authUrl");

  const callbackUrl = new URL(redirectParam);
  callbackUrl.searchParams.set("access_token", "test-token");
  callbackUrl.searchParams.set("user_id", "user-1");

  const res = await fetch(callbackUrl.toString(), { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), `${dashboardUrl}/`);

  const callback = await waitForCallback();
  assert.equal(callback.accessToken, "test-token");
  assert.equal(callback.userId, "user-1");
});
