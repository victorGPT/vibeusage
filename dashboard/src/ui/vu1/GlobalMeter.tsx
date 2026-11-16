import { copy } from "#src/lib/copy.ts";
import { BarGraph } from "#src/ui/hardware/bar-graph.tsx";

import { abbr, full } from "./format";
import "./blocks.css";
import "./landing.css";

type GlobalMeterProps = { tokens: number; cost: number; users: number; bars: number[] };

// The page owns where the figures come from; the landing passes frozen example figures.
export function GlobalMeter({ tokens, cost, users, bars }: GlobalMeterProps) {
  const max = Math.max(0, ...bars);
  const reads = [
    [copy("vu1.landing.meter_tokens"), abbr(tokens)],
    [copy("vu1.landing.meter_spend"), `$${abbr(cost)}`],
    [copy("vu1.landing.meter_users"), full(users)],
  ];
  return (
    <section data-vu1="screen" data-variant="meter" aria-label={copy("vu1.landing.meter_aria")}>
      <div data-vu1="screen-head" data-vu1-cap="">
        <span data-vu1="red">{copy("vu1.landing.meter_period")}</span>
        <span data-vu1="range">{copy("vu1.landing.meter_scope")}</span>
      </div>
      <dl data-vu1="reads" data-vu1-cap="" className="m-0">
        {reads.map(([label, value]) => (
          <div key={label} data-vu1="read">
            <dt>{label}</dt>
            <dd data-vu1="read-value">{value}</dd>
          </div>
        ))}
      </dl>
      <BarGraph label={copy("vu1.landing.meter_bars_aria")} values={bars.map((v) => (max ? v / max : 0))} segments={22} />
    </section>
  );
}
