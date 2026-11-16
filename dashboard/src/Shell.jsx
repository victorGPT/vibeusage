import { Hardware } from "./ui/hardware/hardware";
import { Toasts } from "./ui/hardware/toaster";

const KEY_COLOR = { l: 0.64, c: 0.31, h: 48 };

// The one hardware skin root for every route, with the toast stack beside the pages.
export function Shell({ children }) {
  return (
    <Hardware keyColor={KEY_COLOR} className="min-h-screen">
      {children}
      <Toasts />
    </Hardware>
  );
}
