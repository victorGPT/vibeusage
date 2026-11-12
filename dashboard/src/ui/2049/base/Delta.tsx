import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Delta.dc.html. Only a fall is red; a rise stays in the label tone.
export function Delta({ value, suffix }: { value: number; suffix?: string }) {
  const mark = value > 0 ? `▲ ${value}` : value < 0 ? `▼ ${-value}` : "—";
  return (
    <span className="inline-flex items-baseline gap-2 font-sans text-label/none font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">
      <span className={cn(value < 0 ? "text-destructive" : "text-muted-foreground")}>{mark}</span>
      {suffix ? <span>{suffix}</span> : null}
    </span>
  );
}
