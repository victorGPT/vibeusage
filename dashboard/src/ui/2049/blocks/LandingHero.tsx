import { copy } from "#src/lib/copy.ts";
import { CommandBox } from "#src/ui/2049/base/CommandBox.tsx";
import { Heading } from "#src/ui/2049/base/Heading.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Badge } from "#src/ui/shadcn/badge.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";

// SSOT: design/2049/source/LandingHero.dc.html. The agent line hands over the install guide
// link, kept apart from the command by 8 inside its group and 24 between groups.
export function LandingHero({ signInHref }: { signInHref: string }) {
  return (
    <div className="flex w-full flex-col gap-6 py-2">
      <ul aria-label={copy("ui2049.landing_hero.clis_aria")} className="flex flex-wrap gap-2">
        {String(copy("ui2049.landing_hero.clis"))
          .split(",")
          .map((cli) => (
            <li key={cli}>
              <Badge>{cli}</Badge>
            </li>
          ))}
      </ul>
      <div className="flex flex-col">
        <Heading text={copy("ui2049.landing_hero.title_a")} size="xl" upper level={1} />
        <Heading text={copy("ui2049.landing_hero.title_b")} size="xl" tone="amber" upper level={1} />
      </div>
      <Text text={copy("ui2049.landing_hero.body")} size="l" maxCh={46} />
      <div className="flex flex-col gap-6">
        <CommandBox command={copy("landing.install.command")} />
        <div className="flex flex-col gap-2">
          <Label text={copy("ui2049.landing_hero.agent")} />
          <CommandBox command={copy("landing.ai_agent.command")} prefix="↳" />
        </div>
      </div>
      <div>
        <Button size="lg" nativeButton={false} render={<a href={signInHref} />}>
          {copy("ui2049.state_screen.sign_in")}
        </Button>
      </div>
    </div>
  );
}
