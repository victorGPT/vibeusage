import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(__dirname, "../blocks.css"), "utf8");

// jsdom applies no CSS, so the single look is checked in the stylesheet; the pages' pixels are compared in the PR.
describe("VU-1 blocks have one look", () => {
  it("prints segment names on their keys with no opt-in variant", () => {
    expect(css).not.toMatch(/data-print/);
  });

  it("frames a list screen once, with no bezel ring and no opt-in variant", () => {
    expect(css).not.toMatch(/data-frame/);
    const lcd = css.match(/\[data-vu1="lcd"\] \{([^}]*)\}/)?.[1] ?? "";
    expect(lcd).toContain("padding: var(--spacing-s4);");
    expect(lcd).not.toMatch(/0 0 0 \d+px/);
  });
});
