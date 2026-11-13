import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { CommandBox } from "#src/ui/2049/base/CommandBox.tsx";
import { Display } from "#src/ui/2049/base/Display.tsx";
import { Heading } from "#src/ui/2049/base/Heading.tsx";
import { Label, type LabelTone } from "#src/ui/2049/base/Label.tsx";
import { ScreenFx } from "#src/ui/2049/base/ScreenFx.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";

import { full } from "./format";
import { periodLabel, SCREEN_FILL, SCREEN_MIN_H } from "./shared";

export type StateVariant = "install" | "expired" | "invalid" | "empty" | "loading" | "error";

type StateScreenProps = {
  variant: StateVariant;
  compact?: boolean;
  linkCode?: string;
  kicker?: string;
  onSignIn?: () => void;
  onRetry?: () => void;
};

function header(variant: StateVariant): { kicker: string; tag: string; tone: LabelTone } {
  const core = copy("ui2049.state_screen.core_kicker");
  return {
    install: { kicker: copy("ui2049.state_screen.install_kicker"), tag: copy("ui2049.state_screen.install_tag"), tone: "muted" },
    expired: { kicker: copy("ui2049.state_screen.expired_kicker"), tag: copy("ui2049.state_screen.expired_tag"), tone: "alert" },
    invalid: { kicker: copy("ui2049.identity_bar.public"), tag: copy("ui2049.state_screen.invalid_tag"), tone: "muted" },
    empty: { kicker: copy("ui2049.readout.kicker", { period: periodLabel("total") }), tag: copy("ui2049.state_screen.empty_tag"), tone: "muted" },
    loading: { kicker: core, tag: copy("ui2049.state_screen.loading_tag"), tone: "muted" },
    error: { kicker: core, tag: copy("ui2049.state_screen.error_tag"), tone: "alert" },
  }[variant] as { kicker: string; tag: string; tone: LabelTone };
}

// SSOT: design/2049/source/StateScreen.dc.html. Stands in for the main screen, so it keeps the
// Readout's height unless `compact`.
export function StateScreen({ variant, compact = false, linkCode, onSignIn, onRetry, kicker: ownKicker }: StateScreenProps) {
  const { tag, tone, ...named } = header(variant);
  const kicker = ownKicker ?? named.kicker;
  return (
    <section aria-label={kicker} aria-busy={variant === "loading" ? true : undefined}>
      <ScreenFx className={cn(compact ? "min-h-66" : SCREEN_MIN_H, SCREEN_FILL)}>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between gap-3">
            <Label text={kicker} />
            <Label text={tag} tone={tone} />
          </div>
          {variant === "install" ? (
            <>
              <Heading text={copy("ui2049.state_screen.install_title")} size="s" />
              <Text text={copy("dashboard.install.prompt")} />
              <CommandBox
                command={
                  linkCode
                    ? copy("dashboard.install.cmd.init_link_code", { link_code: linkCode })
                    : copy("landing.install.command")
                }
              />
            </>
          ) : null}
          {variant === "expired" ? (
            <>
              <Heading text={copy("ui2049.state_screen.expired_title")} size="s" />
              <Text text={copy("ui2049.state_screen.expired_body")} />
              <div>
                <Button onClick={onSignIn}>{copy("ui2049.state_screen.sign_in")}</Button>
              </div>
            </>
          ) : null}
          {variant === "invalid" ? (
            <>
              <Heading text={copy("ui2049.state_screen.invalid_title")} size="s" />
              <Text text={copy("ui2049.state_screen.invalid_body")} />
            </>
          ) : null}
          {variant === "empty" ? (
            <>
              <Display text={full(0)} size={64} />
              <Text text={copy("ui2049.state_screen.empty_body")} />
            </>
          ) : null}
          {variant === "loading" ? (
            <>
              <div aria-hidden="true" className="h-16 w-[70%] rounded-sm bg-teal/12" />
              <div aria-hidden="true" className="h-3 w-[40%] rounded-sm bg-teal/12" />
              <div aria-hidden="true" className="h-3 w-[55%] rounded-sm bg-teal/12" />
            </>
          ) : null}
          {variant === "error" ? (
            <>
              <Heading text={copy("ui2049.state_screen.error_title")} size="s" tone="alert" />
              <Text text={copy("ui2049.state_screen.error_body")} />
              <div>
                <Button variant="outline" onClick={onRetry}>
                  {copy("ui2049.state_screen.retry")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </ScreenFx>
    </section>
  );
}
