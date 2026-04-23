import React from "react";
import { Panel } from "./Panel.jsx";

// Retained for call-site stability. New code should import Panel directly.
// SSOT: DESIGN.md §6.

export const ASCII_CHARS = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
};

export function AsciiBox(props) {
  return <Panel variant="ascii" {...props} />;
}
