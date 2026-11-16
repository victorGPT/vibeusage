/* eslint-disable react/prop-types */
import React, { useEffect, useMemo } from "react";
import { copy } from "../lib/copy";
import "../ui/vu1/blocks.css";
import "../ui/vu1/landing.css";
import { AGENT_RESOURCE_ROUTES } from "./agent-resource-routes.js";

function readItems(baseKey, count) {
  return Array.from({ length: count }, (_, index) => copy(`${baseKey}.item${index + 1}`));
}

export function AgentResourcePage({ route }) {
  const routeConfig = route || AGENT_RESOURCE_ROUTES["/developers"];
  const baseKey = `agent.${routeConfig.key}`;
  const items = useMemo(() => readItems(baseKey, 4), [baseKey]);

  useEffect(() => {
    document.title = copy(`${baseKey}.meta_title`);
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", copy(`${baseKey}.meta_description`));
    }
  }, [baseKey]);

  return (
    <div data-vu1="landing" className="px-s4 pt-s4 pb-s8">
      <main className="grid-page mx-auto max-w-shell gap-y-s7">
        <header className="col-span-12 flex flex-col gap-s4 min-[761px]:col-span-9">
          <a data-vu1-cap="" data-vu1="dim" href="/">
            {copy("agent.nav.home")}
          </a>
          <div className="flex flex-col gap-s3">
            <p data-vu1-cap="" data-vu1="dim" className="m-0">
              {copy(`${baseKey}.kicker`)}
            </p>
            <h1 data-vu1="hero-title">{copy(`${baseKey}.title`)}</h1>
          </div>
          <p data-vu1="prose" data-wide="">
            {copy(`${baseKey}.summary`)}
          </p>
        </header>

        <section className="col-span-12 grid-page gap-y-s5">
          {items.map((item, index) => (
            <div key={item} className="col-span-12 flex flex-col gap-s2 min-[761px]:col-span-6">
              <span data-vu1-cap="" data-vu1="dim">
                {copy("agent.item.prefix", { index: String(index + 1).padStart(2, "0") })}
              </span>
              <p data-vu1="prose" data-wide="">
                {item}
              </p>
            </div>
          ))}
        </section>

        <section className="col-span-12 flex flex-col gap-s3">
          <h2 data-vu1="spec-title">{copy("agent.related.title")}</h2>
          <div data-vu1-cap="" className="flex flex-wrap gap-s3">
            {routeConfig.links.map((id) => (
              <a key={id} data-kit="button" data-tone="secondary" data-vu1="cta" href={copy(`agent.link.${id}.url`)}>
                {copy(`agent.link.${id}.label`)}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
