const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("DashboardPage avoids tight retry loop for link code issue", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "dashboard",
    "src",
    "pages",
    "DashboardPage.jsx"
  );
  const src = fs.readFileSync(filePath, "utf8");
  assert.match(src, /linkCodeRequestKeyRef/);
  assert.match(src, /const\s+requestKey\s*=\s*`\$\{baseUrl\}:/);
  assert.match(src, /linkCodeRequestKeyRef\.current\s*===\s*requestKey/);
  assert.match(
    src,
    /\[signedIn,\s*auth\?\.\s*accessToken,\s*baseUrl,\s*linkCode\]/
  );
  assert.doesNotMatch(src, /linkCodeLoading\s*\]/);
});
