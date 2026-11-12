import { copy } from "#src/lib/copy.ts";
import { Heading } from "#src/ui/2049/base/Heading.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

// SSOT: design/2049/source/Features.dc.html.
export function Features() {
  const items = [
    [copy("dashboard.install.title"), copy("ui2049.features.install_title"), copy("ui2049.features.install_body")],
    [copy("ui2049.features.privacy_kicker"), copy("ui2049.features.privacy_title"), copy("ui2049.features.privacy_body")],
    [copy("ui2049.features.compete_kicker"), copy("ui2049.features.compete_title"), copy("ui2049.features.compete_body")],
  ];
  return (
    <section aria-label={copy("ui2049.features.aria")} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map(([kicker, title, body]) => (
        <Card key={kicker} className="min-w-0 gap-2">
          <Label text={kicker} />
          <Heading text={title} size="xs" level={3} />
          <Text text={body} />
        </Card>
      ))}
    </section>
  );
}
