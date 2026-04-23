import React, { useEffect, useMemo, useState } from "react";
import { Select } from "@base-ui/react/select";

import { copy } from "../../../lib/copy";
import { formatCompactNumber, toDisplayNumber, toFiniteNumber } from "../../../lib/format";
import { fetchGithubRepoMeta } from "../../../lib/github-repo-meta";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { shouldFetchGithubStars } from "../util/should-fetch-github-stars.js";

const LIMIT_OPTIONS = [3, 6, 10];

function splitRepoKey(value) {
  if (typeof value !== "string") return { owner: "", repo: "" };
  const [owner, repo] = value.split("/");
  return { owner: owner || "", repo: repo || "" };
}

function resolveTokens(entry) {
  if (!entry) return null;
  const total = entry.total_tokens ?? null;
  const billable = entry.billable_total_tokens ?? null;
  const billableValue = toFiniteNumber(billable);
  const totalValue = toFiniteNumber(total);
  if (billableValue === 0 && totalValue != null && totalValue > 0) {
    return total;
  }
  return billable ?? total ?? null;
}

function useGithubRepoMeta(repoId) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!repoId) return;

    if (typeof window === "undefined") return;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const screenshotCapture =
      typeof document !== "undefined" &&
      (document.documentElement?.classList.contains("screenshot-capture") ||
        document.body?.classList.contains("screenshot-capture"));
    if (!shouldFetchGithubStars({ prefersReducedMotion, screenshotCapture })) {
      return;
    }

    let active = true;
    fetchGithubRepoMeta(repoId)
      .then((meta) => {
        if (!active) return;
        setState(meta);
      })
      .catch(() => {
        if (!active) return;
        setState({ stars: null, avatarUrl: null });
      });

    return () => {
      active = false;
    };
  }, [repoId]);

  return state;
}

export function ProjectUsagePanel({
  entries = [],
  limit = 3,
  onLimitChange,
  loading = false,
  error = null,
  className = "",
}) {
  const placeholder = copy("shared.placeholder.short");
  const tokensLabel = copy("dashboard.projects.tokens_label");
  const starsLabel = copy("dashboard.projects.stars_label");
  const emptyLabel = copy("dashboard.projects.empty");
  const errorLabel = copy("backend.meta.error_label");
  const limitLabel = copy("dashboard.projects.limit_label");
  const limitAria = copy("dashboard.projects.limit_aria");
  const optionLabels = {
    3: copy("dashboard.projects.limit_top_3"),
    6: copy("dashboard.projects.limit_top_6"),
    10: copy("dashboard.projects.limit_top_10"),
  };
  const resolvedLimit = LIMIT_OPTIONS.includes(limit) ? limit : LIMIT_OPTIONS[0];

  const sortedEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries.slice() : [];
    return list.sort((a, b) => {
      const aValue = toFiniteNumber(resolveTokens(a)) ?? 0;
      const bValue = toFiniteNumber(resolveTokens(b)) ?? 0;
      return bValue - aValue;
    });
  }, [entries]);

  const displayEntries = sortedEntries.slice(0, Math.max(1, limit));
  const placeholderEntries = Array.from({ length: Math.max(1, resolvedLimit) }, (_, index) => {
    return index;
  });
  let emptyStateContent = emptyLabel;
  if (loading) {
    emptyStateContent = (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {placeholderEntries.map((index) => (
          <ProjectUsagePlaceholderCard
            key={`placeholder-${index}`}
            placeholder={placeholder}
          />
        ))}
      </div>
    );
  } else if (error) {
    emptyStateContent = (
      <>
        <span>{errorLabel}:</span>{" "}
        <span className="normal-case tracking-normal">{error}</span>
      </>
    );
  }

  const tokenFormatOptions = {
    thousandSuffix: copy("shared.unit.thousand_abbrev"),
    millionSuffix: copy("shared.unit.million_abbrev"),
    billionSuffix: copy("shared.unit.billion_abbrev"),
    decimals: 1,
  };

  return (
    <AsciiBox
      title={copy("dashboard.projects.title")}
      subtitle={copy("dashboard.projects.subtitle")}
      className={className}
      bodyClassName="py-4"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-caption text-ink-text uppercase tracking-caps">
          {limitLabel}
        </span>
        <div className="relative">
          <Select.Root
            value={resolvedLimit}
            items={LIMIT_OPTIONS.map((value) => ({
              value,
              label: optionLabels[value],
            }))}
            onValueChange={(value) => {
              if (typeof onLimitChange === "function" && value != null) {
                onLimitChange(value);
              }
            }}
          >
            <Select.Trigger
              aria-label={limitAria}
              className="btn-chip text-caption uppercase font-bold tracking-caps gap-2"
            >
              <Select.Value />
              <span className="text-ink-bright">▾</span>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner align="end" side="bottom" sideOffset={8} className="z-50">
                <Select.Popup className="w-40 border border-ink-faint bg-surface-strong backdrop-blur-md pointer-events-auto">
                  <Select.List aria-label={limitAria} role="listbox">
                    {LIMIT_OPTIONS.map((value) => (
                      <Select.Item
                        key={value}
                        value={value}
                        className={({ selected }) =>
                          `w-full text-left px-3 py-2 text-caption uppercase tracking-caps transition-colors ${
                            selected
                              ? "bg-surface-raised border-l-2 border-ink"
                              : "hover:bg-surface-raised data-[highlighted]:bg-surface-raised"
                          }`
                        }
                      >
                        <Select.ItemText>{optionLabels[value]}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      {displayEntries.length === 0 ? (
        <div className="text-caption text-ink-text uppercase tracking-caps">
          {emptyStateContent}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayEntries.map((entry) => (
            <ProjectUsageCard
              key={`${entry?.project_key || "repo"}-${entry?.project_ref || ""}`}
              entry={entry}
              placeholder={placeholder}
              tokensLabel={tokensLabel}
              starsLabel={starsLabel}
              tokenFormatOptions={tokenFormatOptions}
            />
          ))}
        </div>
      )}
    </AsciiBox>
  );
}

function ProjectUsageCard({
  entry,
  placeholder,
  tokensLabel,
  starsLabel,
  tokenFormatOptions,
}) {
  const repoKey = typeof entry?.project_key === "string" ? entry.project_key : "";
  const projectRef = typeof entry?.project_ref === "string" ? entry.project_ref : "";
  const { owner, repo } = splitRepoKey(
    repoKey || projectRef.replace("https://github.com/", "")
  );
  const repoId = owner && repo ? `${owner}/${repo}` : repoKey;
  const meta = useGithubRepoMeta(repoId);
  const avatarUrl =
    meta?.avatarUrl || (owner ? `https://github.com/${owner}.png?size=80` : "");
  const starsRaw = meta?.stars;
  const starsFull =
    starsRaw == null ? placeholder : toDisplayNumber(starsRaw);
  const starsCompact =
    starsRaw == null
      ? placeholder
      : formatCompactNumber(starsRaw, tokenFormatOptions);
  const tokensRaw = resolveTokens(entry);
  const tokensFull =
    tokensRaw == null ? placeholder : toDisplayNumber(tokensRaw);
  const tokensCompact =
    tokensRaw == null
      ? placeholder
      : formatCompactNumber(tokensRaw, tokenFormatOptions);

  return (
    <a
      href={projectRef || (repoId ? `https://github.com/${repoId}` : "#")}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-full min-h-[152px] flex-col gap-3 border border-ink-faint bg-surface-raised px-4 py-5 transition-all duration-200 hover:border-ink hover:shadow-glow"
      data-project-card="true"
    >
      <div
        className="absolute right-4 top-4 flex items-center gap-1 text-caption uppercase tracking-caps text-ink-text"
        data-card-line="stars"
        data-star-slot="corner"
        data-star-position="top-right"
      >
        <span className="sr-only">{starsLabel}</span>
        <span className="inline-flex items-center justify-center h-[1.3em] w-[1.3em]">
          <svg
            viewBox="0 0 16 16"
            className="h-full w-full fill-ink"
            data-star-icon="true"
            aria-hidden="true"
          >
            <path d="M8 1.1 10.1 5.4l4.8.7-3.5 3.4.8 4.8L8 11.9l-4.2 2.4.8-4.8L1.1 6.1l4.8-.7L8 1.1z" />
          </svg>
        </span>
        <span
          className="inline-flex items-center h-[1.3em] tabular-nums text-ink-bright"
          title={starsFull}
        >
          {starsCompact}
        </span>
      </div>

      <div
        className="flex items-center gap-3 min-w-0 pr-12"
        data-card-line="identity"
      >
        <div className="relative h-12 w-12 rounded-full border border-ink-faint overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={owner || repoKey}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-surface-raised" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-3"
            data-owner-row="true"
          >
            <div
              className="text-caption text-ink-text uppercase tracking-caps leading-none h-[1.3em] flex items-center truncate max-w-[10rem] sm:max-w-[12rem]"
              data-card-field="owner"
            >
              {owner || placeholder}
            </div>
          </div>
        </div>
      </div>
      <div
        className="text-body font-black text-ink-bright truncate max-w-[14rem] sm:max-w-[16rem] pr-12"
        title={repo || repoKey}
        data-card-line="repo"
        data-card-field="repo"
      >
        {repo || repoKey || placeholder}
      </div>
      <div
        className="flex items-center justify-between gap-3 text-caption uppercase tracking-caps text-ink-text"
        data-card-line="tokens"
      >
        <span>{tokensLabel}</span>
        <span
          className="text-body font-black text-ink tabular-nums"
          title={tokensFull}
        >
          {tokensCompact}
        </span>
      </div>
    </a>
  );
}

function ProjectUsagePlaceholderCard({ placeholder }) {
  return (
    <div
      className="relative flex h-full min-h-[152px] flex-col gap-3 border border-ink-faint bg-surface-raised px-4 py-5 opacity-60"
      data-project-card-placeholder="true"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full border border-ink-faint bg-surface-strong" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-24 border border-ink-faint bg-surface-strong" />
          <div className="h-3 w-32 border border-ink-faint bg-surface-strong" />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-4 text-caption uppercase tracking-caps text-ink-text">
        <span>{placeholder}</span>
        <span>{placeholder}</span>
      </div>
    </div>
  );
}
