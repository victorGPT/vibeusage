const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

test("auth storage exposes session expired helpers", () => {
  const src = read("dashboard/src/lib/auth-storage.js");
  assert.match(src, /SESSION_EXPIRED_KEY/);
  assert.match(src, /loadSessionExpired/);
  assert.match(src, /setSessionExpired/);
  assert.match(src, /clearSessionExpired/);
  assert.match(src, /markSessionExpired/);
  assert.match(src, /subscribeAuthStorage/);
});

test("useAuth tracks sessionExpired and gates signedIn", () => {
  const src = read("dashboard/src/hooks/use-auth.js");
  assert.match(src, /sessionExpired/);
  assert.match(src, /signedIn/);
  assert.match(src, /!sessionExpired/);
});

test("App gates LandingPage on sessionExpired", () => {
  const src = read("dashboard/src/App.jsx");
  assert.match(src, /!signedIn\s*&&\s*!mockEnabled\s*&&\s*!sessionExpired/);
});

test("DashboardPage shows session expired banner and bypasses auth gate", () => {
  const src = read("dashboard/src/pages/DashboardPage.jsx");
  assert.match(src, /sessionExpired/);
  assert.match(src, /dashboard\.session_expired\.title/);
  assert.match(src, /requireAuthGate\s*=\s*!signedIn\s*&&\s*!mockEnabled\s*&&\s*!sessionExpired/);
});

test("vibescore-api marks session expired on 401", () => {
  const src = read("dashboard/src/lib/vibescore-api.js");
  assert.match(src, /markSessionExpired/);
  assert.match(src, /status\s*===\s*401\s*&&\s*hadAccessToken/);
  assert.match(src, /hasAccessTokenValue/);
});

test("copy registry includes session expired strings", () => {
  const src = read("dashboard/src/content/copy.csv");
  assert.ok(src.includes("dashboard.session_expired.title"));
  assert.ok(src.includes("dashboard.session_expired.subtitle"));
  assert.ok(src.includes("dashboard.session_expired.body"));
  assert.ok(src.includes("dashboard.session_expired.body_tail"));
  assert.ok(src.includes("dashboard.session_expired.copy_label"));
  assert.ok(src.includes("dashboard.session_expired.copied"));
});
