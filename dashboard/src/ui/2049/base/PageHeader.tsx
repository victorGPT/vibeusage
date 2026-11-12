import { Heading } from "./Heading";
import { Label } from "./Label";

// SSOT: design/2049/source/PageHeader.dc.html.
export function PageHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <header className="flex w-full flex-col gap-2 pt-4 pb-2">
      <Heading text={title} size="l" upper level={1} />
      {meta ? <Label text={meta} /> : null}
    </header>
  );
}
