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
