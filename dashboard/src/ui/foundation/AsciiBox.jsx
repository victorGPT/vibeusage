import React from "react";
import { Panel } from "./Panel.jsx";

// Back-compat shim. v3 collapsed card chrome to a single 1px hairline (Panel
// plain), so AsciiBox just delegates. Call sites can keep using <AsciiBox>;
// new code should import Panel directly.
// SSOT: DESIGN.md §6.

export function AsciiBox(props) {
  return <Panel variant="plain" {...props} />;
}
