import { Button } from "#src/ui/shadcn/button.tsx";

import { Heading } from "./Heading";
import { Label } from "./Label";

type CtaBandProps = { title: string; buttonLabel: string; href: string; meta?: string };

// SSOT: design/2049/source/CtaBand.dc.html.
export function CtaBand({ title, buttonLabel, href, meta }: CtaBandProps) {
  return (
    <section className="flex w-full flex-col items-center gap-4 py-6 text-center">
      <Heading text={title} size="m" level={2} />
      <Button size="lg" nativeButton={false} render={<a href={href} />}>
        {buttonLabel}
      </Button>
      {meta ? <Label text={meta} /> : null}
    </section>
  );
}
