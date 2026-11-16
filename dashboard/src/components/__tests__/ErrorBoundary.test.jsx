import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/copy";
import { ErrorBoundary } from "../ErrorBoundary.jsx";

function Broken() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("shows the VU-1 crash screen with the error and reloads on demand", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    const screenEl = screen.getByRole("region", { name: copy("vu1.state.crash_title") });
    expect(screenEl.getAttribute("data-vu1")).toBe("screen");
    expect(screen.getByText(copy("shared.error.prefix", { error: "boom" }))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: copy("vu1.state.reload") }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
