import fs from "node:fs";
import path from "node:path";

import { render, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { DoDontVu1, RULES } from "../DoDontVu1";

const DASHBOARD = path.resolve(__dirname, "../../../..");
const design = fs.readFileSync(path.join(DASHBOARD, "DESIGN.md"), "utf8");

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.getAnimations ??= () => [];
});

describe("Do/Don't gallery", () => {
  it("puts one Do beside one Don't for every rule", () => {
    render(<DoDontVu1 />);
    for (const rule of RULES) {
      const pair = document.querySelector(`[data-rule="${rule.id}"]`) as HTMLElement;
      expect(pair, rule.id).not.toBeNull();
      const verdicts = [...pair.querySelectorAll("figure[data-verdict]")].map((f) => f.getAttribute("data-verdict"));
      expect(verdicts, rule.id).toEqual(["do", "dont"]);
      for (const figure of pair.querySelectorAll("figure")) expect(within(figure as HTMLElement).queryAllByText(/./).length, rule.id).toBeGreaterThan(0);
    }
  });

  it("names a component file that exists for every rule", () => {
    for (const rule of RULES) expect(fs.existsSync(path.join(DASHBOARD, rule.component)), rule.component).toBe(true);
  });

  it("documents every rule under its component in DESIGN.md", () => {
    for (const rule of RULES) expect(design, rule.title).toContain(`### ${rule.title}\n`);
  });
});
