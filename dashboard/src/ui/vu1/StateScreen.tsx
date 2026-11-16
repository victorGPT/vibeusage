import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";

import { InstallCommand } from "./InstallCommand";
import "./blocks.css";

export type StateVariant = "loading" | "empty" | "error" | "signed-out" | "install" | "expired" | "invalid";

const SKELETON = ["w-3/4", "w-1/2", "w-2/3"];

function title(variant: StateVariant) {
  return {
    loading: copy("vu1.state.loading"),
    empty: copy("vu1.state.empty_title"),
    error: copy("vu1.state.error_title"),
    "signed-out": copy("vu1.state.signed_out_title"),
    install: copy("vu1.state.install_title"),
    expired: copy("vu1.state.expired_title"),
    invalid: copy("vu1.state.invalid_title"),
  }[variant];
}

type StateScreenProps = { variant: StateVariant; linkCode?: string | null; onRetry?: () => void; onSignIn?: () => void };

export function StateScreen({ variant, linkCode, onRetry, onSignIn }: StateScreenProps) {
  const name = title(variant);
  return (
    <section data-vu1="screen" aria-label={name} aria-busy={variant === "loading" || undefined} className="min-h-60">
      <h2 data-vu1="state-title">{name}</h2>
      {variant === "loading" ? SKELETON.map((width) => <span key={width} data-vu1="skeleton" aria-hidden className={width} />) : null}
      {variant === "empty" ? <p data-vu1="state-body">{copy("vu1.state.empty_body")}</p> : null}
      {variant === "error" ? (
        <>
          <p data-vu1="state-body">{copy("vu1.state.error_body")}</p>
          <div>
            <Button onClick={onRetry}>{copy("vu1.state.retry")}</Button>
          </div>
        </>
      ) : null}
      {variant === "install" ? (
        <>
          <p data-vu1="state-body">{copy("vu1.state.install_body")}</p>
          <InstallCommand
            command={linkCode ? copy("dashboard.install.cmd.init_link_code", { link_code: linkCode }) : copy("landing.install.command")}
          />
        </>
      ) : null}
      {variant === "invalid" ? <p data-vu1="state-body">{copy("vu1.state.invalid_body")}</p> : null}
      {variant === "signed-out" || variant === "expired" ? (
        <>
          <p data-vu1="state-body">{variant === "expired" ? copy("vu1.state.expired_body") : copy("vu1.state.signed_out_body")}</p>
          <div>
            <Button tone="primary" onClick={onSignIn}>
              {copy("vu1.state.sign_in")}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
