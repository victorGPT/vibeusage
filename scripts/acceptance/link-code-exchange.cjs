#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SERVICE_ROLE_KEY = "srk_test_123";
const BASE_URL = "http://insforge:7130";

function setDenoEnv() {
  globalThis.Deno = {
    env: {
      get(key) {
        if (key === "INSFORGE_INTERNAL_URL") return BASE_URL;
        if (key === "INSFORGE_SERVICE_ROLE_KEY") return SERVICE_ROLE_KEY;
        return undefined;
      },
    },
  };
}

async function main() {
  setDenoEnv();

  const repoRoot = path.resolve(__dirname, "..", "..");
  const fn = await loadEdgeModule(
    path.join(repoRoot, "insforge-src/functions-esm/vibeusage-link-code-exchange.js"),
  );

  const linkCode = "link_code_test";
  const requestId = "req_123";
  const userId = "77777777-7777-7777-7777-777777777777";
  const linkCodeRow = {
    id: "link_code_id",
    user_id: userId,
    code_hash: createHash("sha256").update(linkCode).digest("hex"),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    used_at: null,
    request_id: null,
    device_id: null,
  };

  const db = createLinkCodeExchangeDbMock(linkCodeRow);
  globalThis.createClient = () => ({ database: db.db });

  const req = new Request("http://localhost/functions/vibeusage-link-code-exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_code: linkCode, request_id: requestId }),
  });

  const res = await fn(req);
  assert.equal(res.status, 200);
  const body = await res.json();

  const codeHash = createHash("sha256").update(linkCode).digest("hex");
  const expectedToken = createHash("sha256")
    .update(`${SERVICE_ROLE_KEY}:${codeHash}:${requestId}`)
    .digest("hex");
  const expectedTokenHash = createHash("sha256").update(expectedToken).digest("hex");

  assert.equal(body.token, expectedToken);
  assert.equal(body.user_id, userId);

  const deviceInsert = db.inserts.find((entry) => entry.table === "vibeusage_tracker_devices");
  assert.ok(deviceInsert, "device insert missing");
  const deviceRow = deviceInsert.rows[0];
  assert.equal(body.device_id, deviceRow.id);

  const tokenInsert = db.inserts.find((entry) => entry.table === "vibeusage_tracker_device_tokens");
  assert.ok(tokenInsert, "token insert missing");
  assert.equal(tokenInsert.rows[0].token_hash, expectedTokenHash);
  assert.equal(tokenInsert.rows[0].device_id, deviceRow.id);

  const update = db.updates.find((entry) => entry.table === "vibeusage_link_codes");
  assert.ok(update, "link code update missing");
  assert.equal(update.values.request_id, requestId);
  assert.equal(update.values.device_id, deviceRow.id);

  process.stdout.write("ok: link code exchange uses records api and returns device token\n");
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exitCode = 1;
});

async function loadEdgeModule(resolvedPath) {
  const href = `${pathToFileURL(resolvedPath).href}?t=${Date.now()}`;
  const mod = await import(href);
  if (typeof mod?.default !== "function") {
    throw new Error(`Missing default export for ${resolvedPath}`);
  }
  return mod.default;
}

function createLinkCodeExchangeDbMock(linkCodeRow) {
  const inserts = [];
  const updates = [];
  let row = linkCodeRow ? { ...linkCodeRow } : null;

  function matchesFilters(target, filters) {
    if (!target) return false;
    return filters.every((filter) => {
      if (filter.op === "eq") return target[filter.col] === filter.value;
      if (filter.op === "is") {
        if (filter.value === null) return target[filter.col] == null;
        return target[filter.col] === filter.value;
      }
      return false;
    });
  }

  function from(table) {
    if (table === "vibeusage_link_codes") {
      return {
        select: (columns) => {
          const q = { table, columns, filters: [] };
          return {
            eq: (col, value) => {
              q.filters.push({ op: "eq", col, value });
              return {
                maybeSingle: async () => ({
                  data: matchesFilters(row, q.filters) ? row : null,
                  error: null,
                }),
              };
            },
          };
        },
        update: (values) => {
          const q = { table, values, filters: [] };
          const builder = {
            eq: (col, value) => {
              q.filters.push({ op: "eq", col, value });
              return builder;
            },
            is: (col, value) => {
              q.filters.push({ op: "is", col, value });
              return builder;
            },
            select: (columns) => {
              q.columns = columns;
              return builder;
            },
            maybeSingle: async () => {
              updates.push(q);
              if (!matchesFilters(row, q.filters)) {
                return { data: null, error: null };
              }
              row = { ...row, ...values };
              return { data: row, error: null };
            },
          };
          return builder;
        },
      };
    }

    if (table === "vibeusage_tracker_devices" || table === "vibeusage_tracker_device_tokens") {
      return {
        insert: async (rows) => {
          inserts.push({ table, rows });
          return { error: null };
        },
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }

    return {
      insert: async () => ({ error: null }),
    };
  }

  return {
    db: { from },
    inserts,
    updates,
  };
}
