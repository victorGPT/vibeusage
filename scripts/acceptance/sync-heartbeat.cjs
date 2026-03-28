#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

class DatabaseStub {
  constructor({ tokenRow }) {
    this.tokenRow = tokenRow;
    this.updatePayload = null;
  }

  from() {
    return this;
  }

  select() {
    return this;
  }

  eq() {
    if (this.updatePayload) {
      return { error: null };
    }
    return this;
  }

  maybeSingle() {
    return { data: this.tokenRow, error: null };
  }

  update(payload) {
    this.updatePayload = payload;
    return this;
  }
}

function createClientStub(database) {
  return { database };
}

async function runScenario({ name, lastSyncAt, expectUpdated }) {
  const tokenRow = {
    id: "token-id",
    revoked_at: null,
    last_sync_at: lastSyncAt,
  };

  const db = new DatabaseStub({ tokenRow });
  global.createClient = () => createClientStub(db);
  const syncPing = await loadEdgeModule("../../insforge-src/functions-esm/vibeusage-sync-ping.js");

  const res = await syncPing(
    new Request("http://local/functions/vibeusage-sync-ping", {
      method: "POST",
      headers: { Authorization: "Bearer device-token" },
    }),
  );

  const body = await res.json();
  assert.equal(res.status, 200, `${name}: status`);
  assert.equal(Boolean(body.updated), expectUpdated, `${name}: updated flag`);
  if (expectUpdated) {
    assert.ok(db.updatePayload, `${name}: update payload`);
  }
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = "http://insforge:7130";
  process.env.INSFORGE_ANON_KEY = "anon";
  process.env.INSFORGE_SERVICE_ROLE_KEY = "service";

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === "" ? null : v;
      },
    },
  };

  const oldSync = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const recentSync = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  await runScenario({ name: "old-sync", lastSyncAt: oldSync, expectUpdated: true });
  await runScenario({ name: "recent-sync", lastSyncAt: recentSync, expectUpdated: false });
}

async function loadEdgeModule(relativePath) {
  const href = `${pathToFileURL(require.resolve(relativePath)).href}?t=${Date.now()}`;
  const mod = await import(href);
  if (typeof mod?.default !== "function") {
    throw new Error(`Missing default export for ${relativePath}`);
  }
  return mod.default;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
