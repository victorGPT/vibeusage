#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

const SERVICE_ROLE_KEY = 'srk_test_123';
const USER_JWT = 'user_jwt_test';

class LinkCodeDb {
  constructor(state) {
    this.state = state;
  }

  async rpc(name, args) {
    if (name !== 'vibescore_exchange_link_code') {
      throw new Error(`Unexpected rpc: ${name}`);
    }

    const linkRow = this.state.linkCodes.find((r) => r.code_hash === args.p_code_hash) || null;
    if (!linkRow) return { data: null, error: null };
    if (linkRow.used_at) return { data: null, error: null };
    if (!linkRow.expires_at || Date.parse(linkRow.expires_at) <= Date.now()) {
      return { data: null, error: null };
    }

    const usedAt = new Date().toISOString();
    linkRow.used_at = usedAt;
    linkRow.device_id = args.p_device_id;
    this.state.updates.push({ table: 'vibescore_tracker_link_codes', values: { used_at: usedAt } });

    this.state.inserts.push({
      table: 'vibescore_tracker_devices',
      rows: [
        {
          id: args.p_device_id,
          user_id: linkRow.user_id,
          device_name: args.p_device_name,
          platform: args.p_platform
        }
      ]
    });

    this.state.inserts.push({
      table: 'vibescore_tracker_device_tokens',
      rows: [
        {
          id: args.p_token_id,
          user_id: linkRow.user_id,
          device_id: args.p_device_id,
          token_hash: args.p_token_hash
        }
      ]
    });

    return {
      data: {
        user_id: linkRow.user_id,
        device_id: args.p_device_id,
        used_at: usedAt
      },
      error: null
    };
  }

  from(table) {
    if (table === 'vibescore_tracker_link_codes') {
      return {
        insert: async (rows) => {
          this.state.linkCodes.push(...rows);
          return { error: null };
        },
        update: (values) => ({
          eq: async (col, value) => {
            const row = this.state.linkCodes.find((r) => r[col] === value);
            if (row) Object.assign(row, values);
            this.state.updates.push({ table, values, where: { col, value } });
            return { error: null };
          }
        })
      };
    }

    if (table === 'vibescore_tracker_devices' || table === 'vibescore_tracker_device_tokens') {
      return {
        insert: async (rows) => {
          this.state.inserts.push({ table, rows });
          return { error: null };
        }
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

function createClientStub(state, token) {
  if (token === USER_JWT) {
    return {
      auth: {
        async getCurrentUser() {
          return { data: { user: { id: 'user-id' } }, error: null };
        }
      },
      database: new LinkCodeDb(state)
    };
  }

  if (token === SERVICE_ROLE_KEY) {
    return {
      database: new LinkCodeDb(state)
    };
  }

  throw new Error(`Unexpected edgeFunctionToken: ${token}`);
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  process.env.INSFORGE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  if (!globalThis.crypto?.subtle) {
    throw new Error('global crypto.subtle is required for this acceptance test');
  }
  if (!globalThis.crypto.randomUUID && nodeCrypto.randomUUID) {
    globalThis.crypto.randomUUID = nodeCrypto.randomUUID;
  }

  const state = { linkCodes: [], inserts: [], updates: [] };
  global.createClient = ({ edgeFunctionToken }) => createClientStub(state, edgeFunctionToken);

  const issueLinkCode = require('../../insforge-src/functions/vibescore-link-code-issue');
  const exchangeLinkCode = require('../../insforge-src/functions/vibescore-link-code-exchange');

  const issueReq = new Request('http://local/functions/vibescore-link-code-issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${USER_JWT}`
    },
    body: JSON.stringify({})
  });

  const issueRes = await issueLinkCode(issueReq);
  assert.equal(issueRes.status, 200);
  const issued = await issueRes.json();
  assert.equal(typeof issued.link_code, 'string');

  const exchangeReq = new Request('http://local/functions/vibescore-link-code-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link_code: issued.link_code, device_name: 'test-mac', platform: 'macos' })
  });

  const exchangeRes = await exchangeLinkCode(exchangeReq);
  assert.equal(exchangeRes.status, 200);
  const exchanged = await exchangeRes.json();
  assert.equal(typeof exchanged.device_id, 'string');
  assert.equal(typeof exchanged.token, 'string');

  const linkRow = state.linkCodes[0];
  assert.ok(linkRow.used_at, 'expected link code marked as used');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        link_code: issued.link_code,
        device_id: exchanged.device_id,
        inserts: state.inserts.length,
        updates: state.updates.length
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
