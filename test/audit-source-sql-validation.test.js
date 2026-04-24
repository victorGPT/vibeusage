const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  queryDbTotalsViaInsforge,
  resolveUserIdViaInsforge,
} = require("../src/lib/ops/audit-source");

// These tests do NOT actually spawn `insforge`. They assert that the
// validation layer rejects malicious or malformed inputs before we ever
// reach the subprocess. Follow-up assertion: if someone removes the regex
// gate one of these cases flips to an `insforge-db-query-failed` (or a
// crash), and CI catches it.

test("queryDbTotalsViaInsforge rejects non-UUID userId without invoking insforge", () => {
  const res = queryDbTotalsViaInsforge({
    userId: "bad'; DROP TABLE users; --",
    source: "claude",
    windowStartIso: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid-user-id");
  assert.match(res.message, /non-UUID user id/);
});

test("queryDbTotalsViaInsforge rejects empty / null userId", () => {
  for (const v of [null, undefined, "", "   "]) {
    const res = queryDbTotalsViaInsforge({
      userId: v,
      source: "claude",
      windowStartIso: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, "invalid-user-id", `failed for userId=${JSON.stringify(v)}`);
  }
});

test("queryDbTotalsViaInsforge rejects non-identifier source id", () => {
  const res = queryDbTotalsViaInsforge({
    userId: "88377842-7d72-4e19-96f1-2c96fea8840e",
    source: "claude'; DROP",
    windowStartIso: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid-source-id");
});

test("queryDbTotalsViaInsforge rejects non-ISO windowStartIso", () => {
  const res = queryDbTotalsViaInsforge({
    userId: "88377842-7d72-4e19-96f1-2c96fea8840e",
    source: "claude",
    windowStartIso: "yesterday'; DROP",
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid-window-start");
});

test("queryDbTotalsViaInsforge accepts well-formed inputs (falls through to insforge invocation)", () => {
  // We cannot assert full success without a live insforge CLI, but with valid
  // inputs the validation layer must pass control through, landing on the
  // `insforge-db-query-failed` branch when insforge is not linked.
  const res = queryDbTotalsViaInsforge({
    userId: "88377842-7d72-4e19-96f1-2c96fea8840e",
    source: "claude",
    windowStartIso: "2026-04-20T00:00:00.000Z",
  });
  // Either insforge is linked (ok:true) or it is not (ok:false with
  // insforge-db-query-failed). Validation-layer errors must not appear.
  assert.notEqual(res.error, "invalid-user-id");
  assert.notEqual(res.error, "invalid-source-id");
  assert.notEqual(res.error, "invalid-window-start");
});

test("resolveUserIdViaInsforge rejects non-UUID deviceId without invoking insforge", () => {
  // A non-UUID deviceId must short-circuit to null; crucially, it must not
  // reach spawnSync. We cannot directly observe "did not spawn" without
  // mocking, but we can assert the function returns null without side effects
  // and completes synchronously.
  assert.equal(resolveUserIdViaInsforge({ deviceId: "not-a-uuid" }), null);
  assert.equal(resolveUserIdViaInsforge({ deviceId: "'; DROP TABLE --" }), null);
  assert.equal(resolveUserIdViaInsforge({ deviceId: "" }), null);
  assert.equal(resolveUserIdViaInsforge({ deviceId: null }), null);
  assert.equal(resolveUserIdViaInsforge({}), null);
});
