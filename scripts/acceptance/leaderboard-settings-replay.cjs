#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

async function main() {
  const fn = require('../../insforge-functions/vibescore-leaderboard-settings');

  const userId = '11111111-2222-3333-4444-555555555555';
  const userJwt = 'user_jwt_test';

  setDenoEnv({ INSFORGE_INTERNAL_URL: 'http://insforge:7130' });

  const state = {
    row: null,
    inserts: 0,
    updates: 0
  };

  globalThis.createClient = (args) => {
    assert.equal(args?.edgeFunctionToken, userJwt);

    return {
      auth: {
        getCurrentUser: async () => ({ data: { user: { id: userId } }, error: null })
      },
      database: {
        from: (table) => {
          assert.equal(table, 'vibescore_user_settings');

          return {
            select: () => ({
              eq: (col, value) => {
                assert.equal(col, 'user_id');
                assert.equal(value, userId);
                return {
                  maybeSingle: async () => ({ data: state.row, error: null })
                };
              }
            }),
            insert: async (rows) => {
              state.inserts += 1;
              state.row = rows?.[0] || null;
              return { error: null };
            },
            update: (values) => ({
              eq: async (col, value) => {
                assert.equal(col, 'user_id');
                assert.equal(value, userId);
                state.updates += 1;
                state.row = { ...(state.row || { user_id: userId }), ...values, user_id: userId };
                return { error: null };
              }
            })
          };
        }
      }
    };
  };

  const first = await callSettings(fn, { userJwt, leaderboardPublic: true });
  assert.equal(first.leaderboard_public, true);
  assert.ok(typeof first.updated_at === 'string' && first.updated_at.includes('T'));
  assert.equal(state.inserts, 1);
  assert.equal(state.updates, 0);

  const second = await callSettings(fn, { userJwt, leaderboardPublic: true });
  assert.equal(second.leaderboard_public, true);
  assert.equal(state.inserts, 1);
  assert.equal(state.updates, 1);

  const third = await callSettings(fn, { userJwt, leaderboardPublic: false });
  assert.equal(third.leaderboard_public, false);
  assert.equal(state.inserts, 1);
  assert.equal(state.updates, 2);

  assert.equal(state.row?.user_id, userId);
  assert.equal(state.row?.leaderboard_public, false);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        inserts: state.inserts,
        updates: state.updates,
        final: state.row
      },
      null,
      2
    ) + '\n'
  );
}

async function callSettings(fn, { userJwt, leaderboardPublic }) {
  const req = new Request('http://localhost/functions/vibescore-leaderboard-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
    body: JSON.stringify({ leaderboard_public: leaderboardPublic })
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
      }
    }
  };
}

