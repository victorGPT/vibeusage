import { Label } from "./Label";

// SSOT: design/2049/source/PageFooter.dc.html.
export function PageFooter({ left, right }: { left: string; right: string }) {
  return (
    <footer className="flex w-full flex-wrap justify-between gap-2 border-t border-border pt-4">
      <Label text={left} />
      <Label text={right} />
    </footer>
  );
}
