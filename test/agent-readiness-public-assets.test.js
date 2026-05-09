const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

test("public OpenAPI spec exposes security schemes and scoped permissions", () => {
  const spec = readJson("dashboard/public/openapi.json");
  const schemes = spec.components.securitySchemes;

  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.info.title, "VibeUsage API");
  assert.ok(spec.paths["/functions/vibeusage-usage-summary"]);
  assert.ok(spec.paths["/functions/vibeusage-ingest"]);
  assert.ok(schemes.UserJWT);
  assert.ok(schemes.DeviceToken);
  assert.ok(schemes.ShareToken);
  assert.ok(schemes.ServiceRoleKey);
  assert.ok(schemes.UserJWT["x-vibeusage-permissions"].includes("usage:read"));
  assert.ok(schemes.DeviceToken["x-vibeusage-permissions"].includes("usage:ingest"));
  assert.ok(
    spec.paths["/functions/vibeusage-usage-summary"].get["x-required-permissions"].includes(
      "usage:read",
    ),
  );
});

test("MCP manifest is valid JSON and points agents to OpenAPI", () => {
  const manifest = readJson("dashboard/public/.well-known/mcp/manifest.json");

  assert.equal(manifest.name, "VibeUsage");
  assert.equal(manifest.openapi_url, "https://www.vibeusage.cc/openapi.json");
  assert.equal(manifest.transport_status, "documented");
  assert.equal(manifest.transport, undefined);
  assert.ok(manifest.auth.permissions_supported.includes("usage:read"));
  assert.ok(manifest.tools.some((tool) => tool.name === "get_usage_summary"));
});

test("llms and sitemap include developer discovery resources", () => {
  const llms = read("dashboard/public/llms.txt");
  const sitemap = read("dashboard/public/sitemap.xml");

  for (const url of [
    "https://www.vibeusage.cc/developers",
    "https://www.vibeusage.cc/openapi.json",
    "https://www.vibeusage.cc/docs/api",
    "https://www.vibeusage.cc/docs/auth",
    "https://www.vibeusage.cc/docs/webhooks",
    "https://www.vibeusage.cc/mcp",
    "https://www.vibeusage.cc/compare/ai-token-usage-tracking",
    "https://www.vibeusage.cc/guides/ai-token-usage-monitoring",
  ]) {
    assert.ok(llms.includes(url), `llms.txt should include ${url}`);
    assert.ok(sitemap.includes(url), `sitemap.xml should include ${url}`);
  }
});

test("developer discovery pages have no-JS static HTML fallbacks", () => {
  for (const relPath of [
    "dashboard/public/developers/index.html",
    "dashboard/public/docs/api/index.html",
    "dashboard/public/docs/auth/index.html",
    "dashboard/public/docs/webhooks/index.html",
    "dashboard/public/mcp/index.html",
    "dashboard/public/compare/ai-token-usage-tracking/index.html",
    "dashboard/public/guides/ai-token-usage-monitoring/index.html",
  ]) {
    const html = read(relPath);
    assert.match(html, /<h1>[^<]*VibeUsage|<h1>AI Token Usage|<h1>How to Monitor/);
    assert.ok(!html.includes('id="root"'), `${relPath} should not require React hydration`);
  }
});
