#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class DatabaseStub {
  constructor({ tokenRows = [], aggregateRows = [], eventRows = [] } = {}) {
    this.tokenRows = tokenRows;
    this.aggregateRows = aggregateRows;
    this.eventRows = eventRows;
    this._table = null;
    this._select = null;
  }

  from(table) {
    this._table = table;
    return this;
  }

  select(columns) {
    this._select = columns;
    return this;
  }

  eq() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }

    return this;
  }

  order() {
    if (this._table === 'vibescore_tracker_device_tokens') {
      return this;
    }

    if (this._table !== 'vibescore_tracker_hourly') {
      return { data: [], error: null };
    }

    return { data: this.aggregateRows, error: null };
  }

  limit(n) {
    if (this._table === 'vibescore_tracker_device_tokens') {
      return { data: this.tokenRows.slice(0, n), error: null };
    }
    return { data: [], error: null };
  }
}

function createClientStub(database) {
  return {
    auth: {
      async getCurrentUser() {
        return { data: { user: { id: 'user-id' } }, error: null };
      }
    },
    database
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = 'http://insforge:7130';
  process.env.INSFORGE_ANON_KEY = 'anon';

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === '' ? null : v;
      }
    }
  };

  const tokenRows = [{ last_sync_at: '2025-12-22T10:30:00Z' }];
  global.createClient = () => createClientStub(new DatabaseStub({ tokenRows }));
  delete require.cache[require.resolve('../../insforge-src/functions/vibescore-usage-hourly.js')];
  const usageHourly = require('../../insforge-src/functions/vibescore-usage-hourly.js');

  const res = await usageHourly(
    new Request('http://local/functions/vibescore-usage-hourly?day=2025-12-22', {
      method: 'GET',
      headers: { Authorization: 'Bearer user-jwt' }
    })
  );

  const body = await res.json();
  assert.equal(res.status, 200, 'status');
  assert.equal(body.day, '2025-12-22', 'day');
  assert.ok(body.sync, 'sync');
  assert.equal(body.sync.last_sync_at, '2025-12-22T10:30:00.000Z', 'last_sync_at');
  assert.equal(body.sync.min_interval_minutes, 30, 'min_interval_minutes');

  const row1030 = body.data.find((row) => row.hour === '2025-12-22T10:30:00');
  const row11 = body.data.find((row) => row.hour === '2025-12-22T11:00:00');
  assert.ok(row1030, 'row1030');
  assert.ok(row11, 'row11');
  assert.ok(!row1030.missing, '10:30 not missing');
  assert.ok(row11.missing, '11:00 missing');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
