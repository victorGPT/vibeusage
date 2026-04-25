import { useEffect } from "react";

// Global keybind layer — DESIGN.md §11 v3.
// Hacker / cyberpunk register expects power-user keyboard control.
// All bindings are single-key, fire on keydown when no input is focused.

export interface GlobalKeybindHandlers {
  onTogglePeriod?: (next: "day" | "week" | "month" | "total") => void;
  onRefresh?: () => void;
  onShare?: () => void;
  onToggleCheatsheet?: () => void;
  onCloseCheatsheet?: () => void;
  enabled?: boolean;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useGlobalKeybinds(handlers: GlobalKeybindHandlers): void {
  const {
    onTogglePeriod,
    onRefresh,
    onShare,
    onToggleCheatsheet,
    onCloseCheatsheet,
    enabled = true,
  } = handlers;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // Esc closes the cheatsheet regardless of other state.
      if (event.key === "Escape") {
        onCloseCheatsheet?.();
        return;
      }

      switch (event.key) {
        case "?":
          event.preventDefault();
          onToggleCheatsheet?.();
          return;
        case "d":
        case "D":
          event.preventDefault();
          onTogglePeriod?.("day");
          return;
        case "w":
        case "W":
          event.preventDefault();
          onTogglePeriod?.("week");
          return;
        case "m":
        case "M":
          event.preventDefault();
          onTogglePeriod?.("month");
          return;
        case "t":
        case "T":
          event.preventDefault();
          onTogglePeriod?.("total");
          return;
        case "r":
        case "R":
          event.preventDefault();
          onRefresh?.();
          return;
        case "s":
        case "S":
          event.preventDefault();
          onShare?.();
          return;
        default:
          return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onTogglePeriod,
    onRefresh,
    onShare,
    onToggleCheatsheet,
    onCloseCheatsheet,
  ]);
}
