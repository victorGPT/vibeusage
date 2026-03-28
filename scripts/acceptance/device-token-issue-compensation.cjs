#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

class QueryStub {
  constructor(table, state) {
    this.table = table;
    this.state = state;
    this.filters = [];
    this.error = null;
  }

  insert(rows) {
    this.state.inserts.push({ table: this.table, rows });
    if (this.table === "vibeusage_tracker_device_tokens") {
      return { error: new Error("token insert failed") };
    }
    return { error: null };
  }

  delete() {
    const record = { table: this.table, filters: this.filters };
    this.state.deletes.push(record);
    this.error = null;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }
}

class DatabaseStub {
  constructor(state) {
    this.state = state;
  }

  from(table) {
    return new QueryStub(table, this.state);
  }
}

function createClientStub(state) {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: "user-id" } }, error: null };
      },
    },
    database: new DatabaseStub(state),
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = "http://insforge:7130";
  process.env.INSFORGE_ANON_KEY = "anon";
  process.env.INSFORGE_SERVICE_ROLE_KEY = "service-role-key";

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === "" ? null : v;
      },
    },
  };

  if (!globalThis.crypto?.subtle) {
    throw new Error("global crypto.subtle is required for this acceptance test");
  }
  if (!globalThis.crypto.randomUUID && nodeCrypto.randomUUID) {
    globalThis.crypto.randomUUID = nodeCrypto.randomUUID;
  }

  const state = { inserts: [], deletes: [] };
  global.createClient = () => createClientStub(state);

  const issueToken = await loadEdgeModule("../../insforge-src/functions-esm/vibeusage-device-token-issue.js");

  const req = new Request("http://local/functions/vibeusage-device-token-issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer service-role-key",
    },
    body: JSON.stringify({
      user_id: "11111111-1111-1111-1111-111111111111",
      device_name: "test-mac",
      platform: "macos",
    }),
  });

  const res = await issueToken(req);
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.error, "Failed to issue device token");

  const deviceInsert = state.inserts.find((i) => i.table === "vibeusage_tracker_devices");
  assert.ok(deviceInsert, "device insert not performed");

  const tokenInsert = state.inserts.find((i) => i.table === "vibeusage_tracker_device_tokens");
  assert.ok(tokenInsert, "token insert not performed");

  const deviceId = deviceInsert.rows?.[0]?.id;
  assert.equal(typeof deviceId, "string");

  const deleteCall = state.deletes.find((d) => d.table === "vibeusage_tracker_devices");
  assert.ok(deleteCall, "compensation delete not performed");

  const idFilter = deleteCall.filters.find((f) => f.column === "id");
  assert.equal(idFilter?.value, deviceId);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        device_id: deviceId,
        delete_filters: deleteCall.filters,
      },
      null,
      2,
    ) + "\n",
  );
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
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
