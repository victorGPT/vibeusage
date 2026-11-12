import { copy } from "#src/lib/copy.ts";

// SSOT: design/2049/source/Stamp.dc.html. The footer line of a block meant to be screenshotted:
// handle and range shrink with an ellipsis so the three parts never wrap.
export function Stamp({ handle, range }: { handle: string; range: string }) {
  return (
    <div className="mt-auto flex w-full flex-nowrap items-baseline gap-4 border-t border-border pt-3 font-sans text-label/none font-semibold tracking-label text-muted-foreground uppercase">
      <span className="max-w-2/5 min-w-0 flex-[0_1_auto] truncate">{`@${handle}`}</span>
      <span className="min-w-0 flex-1 truncate text-center">{range}</span>
      <span className="flex-none whitespace-nowrap">{copy("ui2049.stamp.site")}</span>
    </div>
  );
}
