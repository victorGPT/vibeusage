const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = raw[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

test("LandingPage renders the 2049 landing blocks in board order", () => {
  const src = read("dashboard/src/pages/LandingPage.jsx");
  const order = ["<TopNav", "<LandingHero", "<Readout", "<Features", "<CtaBand"];
  const positions = order.map((tag) => src.indexOf(tag));
  for (const [i, pos] of positions.entries()) assert.ok(pos > 0, `expected ${order[i]} in LandingPage`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(src, /<Readout[^>]*mode="sample"/);
});

test("copy registry includes landing/share meta keys", () => {
  const csv = read("dashboard/src/content/copy.csv");
  const rows = parseCsv(csv);
  const map = new Map();
  for (const row of rows) {
    if (!row.length) continue;
    map.set(row[0], row[5] || "");
  }

  const keys = [
    "landing.meta.title",
    "landing.meta.description",
    "landing.meta.og_site_name",
    "landing.meta.og_type",
    "landing.meta.og_image",
    "landing.meta.og_url",
    "landing.meta.twitter_card",
    "share.meta.title",
    "share.meta.description",
    "share.meta.og_site_name",
    "share.meta.og_type",
    "share.meta.og_image",
    "share.meta.og_url",
    "share.meta.twitter_card",
  ];

  for (const key of keys) {
    assert.ok(map.has(key), `expected meta key: ${key}`);
    assert.ok(map.get(key), `expected meta value for: ${key}`);
  }
});
