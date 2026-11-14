import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import runtimeDefaults from "../../../../src/shared/runtime-defaults.cjs";

const { DEFAULT_INSFORGE_BASE_URL } = runtimeDefaults as any;

describe("dashboard auth refresh cookie is first-party", () => {
  it("auth client talks to the page origin, so the refresh cookie lands on the dashboard host", async () => {
    const { createInsforgeAuthClient } = await import("../insforge-client");
    const client = createInsforgeAuthClient();
    expect(client.getHttpClient().baseUrl).toBe(window.location.origin);
  });

  it("vercel forwards /api/auth/* to InsForge before the SPA catch-all", () => {
    const vercel = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../../vercel.json"), "utf8"),
    );
    const rewrites: { source: string; destination: string }[] = vercel.rewrites;
    const authIndex = rewrites.findIndex((r) => r.source === "/api/auth/:path*");
    const catchAllIndex = rewrites.findIndex((r) => r.source === "/(.*)");
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeLessThan(catchAllIndex);
    expect(rewrites[authIndex].destination).toBe(`${DEFAULT_INSFORGE_BASE_URL}/api/auth/:path*`);
  });
});
