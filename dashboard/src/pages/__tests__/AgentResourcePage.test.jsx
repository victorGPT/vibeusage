import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copy } from "../../lib/copy";
import { AgentResourcePage } from "../AgentResourcePage.jsx";
import { AGENT_RESOURCE_ROUTES } from "../agent-resource-routes.js";

describe("AgentResourcePage", () => {
  it("lays the resource out in VU-1 type with its items and related links", () => {
    const route = AGENT_RESOURCE_ROUTES["/docs/api"];
    const { container } = render(<AgentResourcePage route={route} />);
    expect(screen.getByRole("heading", { level: 1, name: copy("agent.api.title") }).getAttribute("data-vu1")).toBe("hero-title");
    for (let n = 1; n <= 4; n++) expect(screen.getByText(copy(`agent.api.item${n}`))).toBeTruthy();
    for (const id of route.links) {
      expect(screen.getByRole("link", { name: copy(`agent.link.${id}.label`) }).getAttribute("href")).toBe(copy(`agent.link.${id}.url`));
    }
    expect(container.querySelector(".fx-scanline, .fx-grid, .text-ink")).toBeNull();
    expect(document.title).toBe(copy("agent.api.meta_title"));
  });
});
