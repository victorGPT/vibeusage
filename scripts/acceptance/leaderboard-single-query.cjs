#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class QueryStub {
  constructor(parent, table) {
    this.parent = parent;
    this.table = table;
    this._or = null;
  }

  select() {
    return this;
  }

  or(filter) {
    this._or = filter;
    return this;
  }

  order() {
    if (this.table === this.parent.entriesView && this._or) {
      if (this.parent.singleError) {
        return { data: null, error: new Error('or not supported') };
      }
      return { data: this.parent.singleRows, error: null };
    }
    return this;
  }

  limit(value) {
    this.parent.limitValue = value;
    return { data: this.parent.fallbackEntries, error: null };
  }

  maybeSingle() {
    return { data: this.parent.meRow, error: null };
  }
}

class DatabaseStub {
  constructor({ entriesView, meView, singleRows, fallbackEntries, meRow, singleError }) {
    this.entriesView = entriesView;
    this.meView = meView;
    this.singleRows = singleRows;
    this.fallbackEntries = fallbackEntries;
    this.meRow = meRow;
    this.singleError = singleError;
    this.limitValue = null;
    this.tables = [];
  }

  from(table) {
    this.tables.push(table);
    return new QueryStub(this, table);
  }
}

function createClientStub(db) {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database: db
  };
}

async function runScenario({ name, singleError }) {
  const entriesView = 'vibescore_leaderboard_day_current';
  const meView = 'vibescore_leaderboard_me_day_current';

  const singleRows = [
    { rank: 1, is_me: false, display_name: 'Alpha', avatar_url: null, total_tokens: '10' },
    { rank: 99, is_me: true, display_name: 'Me', avatar_url: null, total_tokens: '9' }
  ];

  const fallbackEntries = [
    { rank: 1, is_me: false, display_name: 'Alpha', avatar_url: null, total_tokens: '10' }
  ];

  const meRow = { rank: 99, total_tokens: '9' };

  const db = new DatabaseStub({
    entriesView,
    meView,
    singleRows,
    fallbackEntries,
    meRow,
    singleError
  });

  global.createClient = () => createClientStub(db);
  delete require.cache[require.resolve('../../insforge-src/functions/vibescore-leaderboard.js')];
  const leaderboard = require('../../insforge-src/functions/vibescore-leaderboard.js');

  const res = await leaderboard(
    new Request('http://local/functions/vibescore-leaderboard?period=day&limit=1', {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();
  assert.equal(res.status, 200, `${name}: status`);

  if (singleError) {
    assert.ok(db.tables.includes(meView), `${name}: fallback should query me view`);
    assert.equal(db.limitValue, 1, `${name}: limit should be applied`);
    assert.equal(body.entries.length, 1, `${name}: entries length`);
    assert.equal(body.me.rank, 99, `${name}: me rank`);
  } else {
    assert.ok(!db.tables.includes(meView), `${name}: single query should skip me view`);
    assert.equal(body.entries.length, 1, `${name}: entries length`);
    assert.equal(body.me.rank, 99, `${name}: me rank`);
  }

  return body;
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';
  process.env.INSFORGE_SERVICE_ROLE_KEY = '';
  process.env.SERVICE_ROLE_KEY = '';
  process.env.INSFORGE_API_KEY = '';
  process.env.API_KEY = '';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  const single = await runScenario({ name: 'single', singleError: false });
  const fallback = await runScenario({ name: 'fallback', singleError: true });

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        single: single.entries,
        fallback: fallback.entries
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
