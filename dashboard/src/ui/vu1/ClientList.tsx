import { copy } from "#src/lib/copy.ts";
import "./landing.css";

export function ClientList() {
  return (
    <ul data-vu1="clients" data-vu1-cap="" aria-label={copy("vu1.landing.clis_aria")}>
      {String(copy("vu1.landing.clis"))
        .split(",")
        .map((name) => (
          <li key={name} data-vu1="chip">
            <span data-vu1="led" data-on="" aria-hidden />
            {name}
          </li>
        ))}
    </ul>
  );
}
