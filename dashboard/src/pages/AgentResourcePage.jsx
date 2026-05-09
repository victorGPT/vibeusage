/* eslint-disable react/prop-types */
import React, { useEffect, useMemo } from "react";
import { copy } from "../lib/copy";
import { AGENT_RESOURCE_ROUTES } from "./agent-resource-routes.js";

function readItems(baseKey, count) {
  return Array.from({ length: count }, (_, index) => copy(`${baseKey}.item${index + 1}`));
}

function ResourceLink({ id }) {
  return (
    <a
      href={copy(`agent.link.${id}.url`)}
      className="border border-ink-line bg-surface/70 px-4 py-3 text-caption uppercase tracking-label text-ink-text transition-colors hover:border-ink hover:text-ink"
    >
      {copy(`agent.link.${id}.label`)}
    </a>
  );
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
    <div className="min-h-screen bg-surface font-mono text-ink selection:bg-ink selection:text-surface">
      <div className="fixed inset-0 z-0 opacity-20">
        <div className="absolute inset-0 fx-grid" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-50 fx-scanline" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-ink-line pb-8">
          <a href="/" className="text-caption uppercase tracking-caps text-ink-muted hover:text-ink">
            {copy("agent.nav.home")}
          </a>
          <div className="space-y-4">
            <p className="text-micro uppercase tracking-caps text-ink-muted">
              {copy(`${baseKey}.kicker`)}
            </p>
            <h1 className="max-w-4xl text-display-3 font-black uppercase leading-tight text-ink-bright sm:text-display-2">
              {copy(`${baseKey}.title`)}
            </h1>
            <p className="max-w-3xl text-body leading-relaxed text-ink-text">
              {copy(`${baseKey}.summary`)}
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {items.map((item, index) => (
            <div key={item} className="border border-ink-line bg-surface/70 p-5">
              <span className="text-micro uppercase tracking-caps text-ink-muted">
                {copy("agent.item.prefix", { index: String(index + 1).padStart(2, "0") })}
              </span>
              <p className="mt-3 text-body leading-relaxed text-ink-text">{item}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4 border-t border-ink-line pt-8">
          <h2 className="text-heading font-bold uppercase text-ink">{copy("agent.related.title")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routeConfig.links.map((id) => (
              <ResourceLink key={id} id={id} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
