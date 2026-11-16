import { copy } from "#src/lib/copy.ts";
import { Button } from "#src/ui/hardware/button.tsx";
import "./blocks.css";

export type StateVariant = "loading" | "empty" | "error" | "signed-out";

const SKELETON = ["w-3/4", "w-1/2", "w-2/3"];

function title(variant: StateVariant) {
  return {
    loading: copy("vu1.state.loading"),
    empty: copy("vu1.state.empty_title"),
    error: copy("vu1.state.error_title"),
    "signed-out": copy("vu1.state.signed_out_title"),
  }[variant];
}

export function StateScreen({ variant, onRetry, onSignIn }: { variant: StateVariant; onRetry?: () => void; onSignIn?: () => void }) {
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
      {variant === "signed-out" ? (
        <>
          <p data-vu1="state-body">{copy("vu1.state.signed_out_body")}</p>
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
