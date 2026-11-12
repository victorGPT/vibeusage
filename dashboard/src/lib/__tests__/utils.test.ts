import { describe, expect, it } from "vitest";

import { cn } from "../utils";

describe("cn", () => {
  it("keeps a type-scale size next to a token color", () => {
    expect(cn("text-micro", "text-ink")).toBe("text-micro text-ink");
  });

  it("still lets a later type-scale size win", () => {
    expect(cn("text-body text-ink", "text-micro")).toBe("text-ink text-micro");
  });
});

describe("cn with 2049 tokens", () => {
  it("keeps a 2049 size next to a 2049 color", () => {
    expect(cn("text-label", "text-hero")).toBe("text-label text-hero");
  });

  it("lets a later 2049 size win", () => {
    expect(cn("text-copy-m text-hero", "text-screen-xl")).toBe("text-hero text-screen-xl");
  });
});
