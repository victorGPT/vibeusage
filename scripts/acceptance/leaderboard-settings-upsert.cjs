#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { loadEdgeFunction } = require("../lib/load-edge-function.cjs");

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

async function main() {
  const fn = await loadEdgeFunction("vibeusage-leaderboard-settings");

  const userId = "11111111-2222-3333-4444-555555555555";
  const userJwt = "user_jwt_test";

  setDenoEnv({ INSFORGE_INTERNAL_URL: "http://insforge:7130" });

  const upsertState = {
    row: null,
    upserts: 0,
    selects: 0,
    inserts: 0,
    updates: 0,
  };

  globalThis.createClient = makeClient({
    userId,
    userJwt,
    state: upsertState,
    upsertError: null,
  });

  const upsertRes = await callSettings(fn, { userJwt, leaderboardPublic: true });
  assert.equal(upsertRes.leaderboard_public, true);
  assert.ok(typeof upsertRes.updated_at === "string" && upsertRes.updated_at.includes("T"));
  assert.equal(upsertState.upserts, 1);
  assert.equal(upsertState.selects, 0);
  assert.equal(upsertState.inserts, 0);
  assert.equal(upsertState.updates, 0);

  const fallbackState = {
    row: null,
    upserts: 0,
    selects: 0,
    inserts: 0,
    updates: 0,
  };

  globalThis.createClient = makeClient({
    userId,
    userJwt,
    state: fallbackState,
    upsertError: { message: "on_conflict not supported" },
  });

  const first = await callSettings(fn, { userJwt, leaderboardPublic: true });
  assert.equal(first.leaderboard_public, true);
  assert.equal(fallbackState.upserts, 1);
  assert.equal(fallbackState.selects, 1);
  assert.equal(fallbackState.inserts, 1);
  assert.equal(fallbackState.updates, 0);

  const second = await callSettings(fn, { userJwt, leaderboardPublic: false });
  assert.equal(second.leaderboard_public, false);
  assert.equal(fallbackState.upserts, 2);
  assert.equal(fallbackState.selects, 2);
  assert.equal(fallbackState.inserts, 1);
  assert.equal(fallbackState.updates, 1);

  assert.equal(fallbackState.row?.user_id, userId);
  assert.equal(fallbackState.row?.leaderboard_public, false);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        upsert: {
          upserts: upsertState.upserts,
          selects: upsertState.selects,
          inserts: upsertState.inserts,
          updates: upsertState.updates,
        },
        fallback: {
          upserts: fallbackState.upserts,
          selects: fallbackState.selects,
          inserts: fallbackState.inserts,
          updates: fallbackState.updates,
          final: fallbackState.row,
        },
      },
      null,
      2,
    ) + "\n",
  );
}

function makeClient({ userId, userJwt, state, upsertError }) {
  return (args) => {
    assert.equal(args?.edgeFunctionToken, userJwt);

    return {
      auth: {
        getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null }),
      },
      database: {
        from: (table) => {
          assert.equal(table, "vibeusage_user_settings");

          return {
            upsert: async (rows, options) => {
              state.upserts += 1;
              assert.equal(options?.onConflict, "user_id");
              assert.equal(rows?.[0]?.user_id, userId);
              if (upsertError) return { error: upsertError };
              state.row = rows?.[0] || null;
              return { error: null };
            },
            select: () => ({
              eq: (col, value) => {
                assert.equal(col, "user_id");
                assert.equal(value, userId);
                return {
                  maybeSingle: async () => {
                    state.selects += 1;
                    return { data: state.row, error: null };
                  },
                };
              },
            }),
            insert: async (rows) => {
              state.inserts += 1;
              state.row = rows?.[0] || null;
              return { error: null };
            },
            update: (values) => ({
              eq: async (col, value) => {
                assert.equal(col, "user_id");
                assert.equal(value, userId);
                state.updates += 1;
                state.row = { ...(state.row || { user_id: userId }), ...values, user_id: userId };
                return { error: null };
              },
            }),
          };
        },
      },
    };
  };
}

async function callSettings(fn, { userJwt, leaderboardPublic }) {
  const req = new Request("http://localhost/functions/vibeusage-leaderboard-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: leaderboardPublic }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  return await res.json();
}

function setDenoEnv(env) {
  globalThis.Deno = {
    env: {
      get(key) {
        return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
      },
    },
  };
}
