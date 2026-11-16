import { useSyncExternalStore } from "react";

import { copy } from "#src/lib/copy.ts";
import { SlideSwitch } from "#src/ui/hardware/slide-switch.tsx";

import { periodOptions } from "./labels";
import type { UsagePeriod } from "./types";
import "./blocks.css";

const NARROW = "(max-width: 760px)";

function subscribe(onChange: () => void) {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const narrowNow = () => typeof matchMedia === "function" && matchMedia(NARROW).matches;
const wideOnServer = () => false;

// The kit's switch speaks in labels, so they are mapped back to period ids here.
export function PeriodSwitch({ value, onChange }: { value: UsagePeriod; onChange: (period: UsagePeriod) => void }) {
  const options = periodOptions();
  const narrow = useSyncExternalStore(subscribe, narrowNow, wideOnServer);
  return (
    <div data-vu1="period">
      <SlideSwitch
        label={copy("vu1.period.label")}
        options={options.map((option) => option.label)}
        value={options.find((option) => option.value === value)?.label}
        onValueChange={(label) => {
          const hit = options.find((option) => option.label === label);
          if (hit) onChange(hit.value);
        }}
        orientation={narrow ? "horizontal" : "vertical"}
      />
    </div>
  );
}
