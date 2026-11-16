import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  vi.resetModules();
});

it("key sounds start off when nothing is stored", async () => {
  const { soundEnabled } = await import("../sound");
  expect(soundEnabled()).toBe(false);
});

it("haptics stay silent while key sounds are off", async () => {
  const vibrate = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  const { haptic } = await import("../haptics");
  haptic("light");
  expect(vibrate).not.toHaveBeenCalled();
});

it("turning key sounds on also turns haptics on", async () => {
  const vibrate = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  const { setSoundEnabled } = await import("../sound");
  const { haptic } = await import("../haptics");
  setSoundEnabled(true);
  haptic("light");
  expect(vibrate).toHaveBeenCalled();
});
