import { Button } from "@base-ui/react/button";
import React from "react";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";
import { MatrixButton } from "../../foundation/MatrixButton.jsx";
import { MatrixShell } from "../../foundation/MatrixShell.jsx";
import { CostAnalysisModal } from "../components/CostAnalysisModal.jsx";
import { IdentityCard } from "../components/IdentityCard.jsx";
import { NeuralDivergenceMap } from "../components/NeuralDivergenceMap.jsx";
import { RollingUsagePanel } from "../components/RollingUsagePanel.jsx";
import { TopModelsPanel } from "../components/TopModelsPanel.jsx";
import { TrendMonitor } from "../components/TrendMonitor.jsx";
import { UsagePanel } from "../components/UsagePanel.jsx";

export function DashboardView(props) {
  const {
    copy,
    headerStatus,
    headerRight,
    footerLeftContent,
    screenshotMode,
    publicViewInvalid,
    publicViewInvalidTitle,
    publicViewInvalidBody,
    showExpiredGate,
    showAuthGate,
    sessionExpiredCopied,
    sessionExpiredCopiedLabel,
    sessionExpiredCopyLabel,
    handleCopySessionExpired,
    signInUrl,
    signUpUrl,
    screenshotTitleLine1,
    screenshotTitleLine2,
    identityDisplayName,
    identityStartDate,
    activeDays,
    identitySubscriptions,
    identityScrambleDurationMs,
    projectUsageBlock,
    topModels,
    signedIn,
    publicMode,
    shouldShowInstall,
    installPrompt,
    handleCopyInstall,
    installCopied,
    installCopiedLabel,
    installCopyLabel,
    installInitCmdDisplay,
    linkCodeLoading,
    linkCodeError,
    publicViewTitle,
    handleTogglePublicView,
    publicViewBusy,
    publicViewEnabled,
    publicViewToggleLabel,
    publicViewStatusLabel,
    publicViewCopyButtonLabel,
    handleCopyPublicView,
    trendRowsForDisplay,
    trendFromForDisplay,
    trendToForDisplay,
    period,
    trendTimeZoneLabel,
    activityHeatmapBlock,
    isCapturing,
    handleShareToX,
    screenshotTwitterLabel,
    screenshotTwitterButton,
    screenshotTwitterHint,
    periodsForDisplay,
    setSelectedPeriod,
    metricsRows,
    summaryLabel,
    summaryValue,
    summaryCostValue,
    rollingUsage,
    costInfoEnabled,
    openCostModal,
    allowBreakdownToggle,
    coreIndexCollapsed,
    setCoreIndexCollapsed,
    coreIndexCollapseLabel,
    coreIndexExpandLabel,
    coreIndexCollapseAria,
    coreIndexExpandAria,
    refreshAll,
    usagePanelLoading,
    usagePanelRefreshing,
    usageError,
    rangeLabel,
    timeZoneRangeLabel,
    usageSourceLabel,
    fleetData,
    hasDetailsActual,
    dailyEmptyPrefix,
    installSyncCmd,
    dailyEmptySuffix,
    detailsColumns,
    ariaSortFor,
    toggleSort,
    sortIconFor,
    pagedDetails,
    detailsDateKey,
    renderDetailDate,
    renderDetailCell,
    DETAILS_PAGED_PERIODS,
    detailsPageCount,
    detailsPage,
    setDetailsPage,
    costModalOpen,
    closeCostModal,
  } = props;

  return (
    <>
      <MatrixShell
        hideHeader={screenshotMode}
        headerStatus={headerStatus}
        headerRight={headerRight}
        footerLeft={footerLeftContent ? <span>{footerLeftContent}</span> : null}
        footerRight={<span className="font-bold">{copy("dashboard.footer.right")}</span>}
        contentClassName=""
        rootClassName={screenshotMode ? "screenshot-mode" : ""}
      >
        {publicViewInvalid ? (
          <div className="mb-6">
            <AsciiBox title={publicViewInvalidTitle} className="border-ink-muted">
              <p className="text-micro opacity-50 mt-0">{publicViewInvalidBody}</p>
            </AsciiBox>
          </div>
        ) : null}
        {showExpiredGate ? (
          <div className="mb-6">
            <AsciiBox
              title={copy("dashboard.session_expired.title")}
              subtitle={copy("dashboard.session_expired.subtitle")}
              className="border-ink-muted"
            >
              <p className="text-micro mt-0 flex flex-wrap items-center gap-2">
                <span className="opacity-50">{copy("dashboard.session_expired.body")}</span>
                <MatrixButton
                  className="px-2 py-1 text-micro normal-case"
                  onClick={handleCopySessionExpired}
                >
                  {sessionExpiredCopied ? sessionExpiredCopiedLabel : sessionExpiredCopyLabel}
                </MatrixButton>
                <span className="opacity-50">{copy("dashboard.session_expired.body_tail")}</span>
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : showAuthGate ? (
          <div className="flex items-center justify-center">
            <AsciiBox
              title={copy("dashboard.auth_required.title")}
              subtitle={copy("dashboard.auth_required.subtitle")}
              className="w-full max-w-2xl"
            >
              <p className="text-micro opacity-50 mt-0">{copy("dashboard.auth_required.body")}</p>

              <div className="flex flex-wrap gap-3 mt-4">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
                {screenshotMode ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-display-3 md:text-display-2 font-black text-ink-bright tracking-tight leading-none glow-text">
                        {screenshotTitleLine1}
                      </span>
                      <span className="text-display-3 md:text-display-3 font-black text-ink-bright tracking-tight leading-none glow-text">
                        {screenshotTitleLine2}
                      </span>
                    </div>
                  </div>
                ) : null}
                <IdentityCard
                  title={copy("dashboard.identity.title")}
                  subtitle={copy("dashboard.identity.subtitle")}
                  name={identityDisplayName}
                  avatarUrl={null}
                  isPublic
                  rankLabel={identityStartDate ?? copy("identity_card.rank_placeholder")}
                  streakDays={activeDays}
                  subscriptions={identitySubscriptions}
                  animateTitle={false}
                  scrambleDurationMs={identityScrambleDurationMs}
                />

                <RollingUsagePanel rolling={rollingUsage} />

                <TopModelsPanel rows={topModels} />

                {!screenshotMode && !signedIn && !publicMode ? (
                  <AsciiBox
                    title={copy("dashboard.auth_optional.title")}
                    subtitle={copy("dashboard.auth_optional.subtitle")}
                  >
                    <p className="text-micro opacity-50 mt-0">
                      {copy("dashboard.auth_optional.body")}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <MatrixButton as="a" primary href={signInUrl}>
                        {copy("shared.button.sign_in")}
                      </MatrixButton>
                      <MatrixButton as="a" href={signUpUrl}>
                        {copy("shared.button.sign_up")}
                      </MatrixButton>
                    </div>
                  </AsciiBox>
                ) : null}

                {shouldShowInstall ? (
                  <AsciiBox
                    title={copy("dashboard.install.title")}
                    subtitle={copy("dashboard.install.subtitle")}
                    className="relative"
                  >
                    <div className="text-data tracking-label font-semibold text-ink">
                      {installPrompt}
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <MatrixButton
                        onClick={handleCopyInstall}
                        aria-label={installCopied ? installCopiedLabel : installCopyLabel}
                        title={installCopied ? installCopiedLabel : installCopyLabel}
                        className="w-full justify-between gap-3 normal-case px-3"
                      >
                        <span className="font-mono text-caption md:text-data tracking-data normal-case text-left">
                          {installInitCmdDisplay}
                        </span>
                        <span className="inline-flex items-center justify-center w-7 h-7 border border-ink-muted bg-surface/30">
                          {installCopied ? (
                            <svg
                              viewBox="0 0 16 16"
                              className="w-4 h-4 text-ink"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5-5L12.5 5z" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 16 16"
                              className="w-4 h-4 text-ink"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M11 1H4a1 1 0 0 0-1 1v9h1V2h7V1z" />
                              <path d="M5 4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4zm1 0v9h6V4H6z" />
                            </svg>
                          )}
                        </span>
                      </MatrixButton>
                      {linkCodeLoading ? (
                        <span className="text-data opacity-40">
                          {copy("dashboard.install.link_code.loading")}
                        </span>
                      ) : linkCodeError ? (
                        <span className="text-data opacity-40">
                          {copy("dashboard.install.link_code.failed")}
                        </span>
                      ) : null}
                    </div>
                  </AsciiBox>
                ) : null}

                {!screenshotMode && signedIn && !publicMode ? (
                  <AsciiBox title={publicViewTitle} className="relative">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            onClick={handleTogglePublicView}
                            disabled={publicViewBusy}
                            aria-pressed={publicViewEnabled}
                            aria-label={publicViewToggleLabel}
                            title={publicViewToggleLabel}
                            className={`relative inline-flex h-6 w-11 items-center border px-[3px] transition-colors ${
                              publicViewEnabled
                                ? "border-ink bg-ink-faint"
                                : "border-ink-muted bg-surface/40"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <span
                              aria-hidden="true"
                              className={`inline-block h-3.5 w-3.5 bg-ink transition-transform ${
                                publicViewEnabled ? "translate-x-[18px]" : "translate-x-0"
                              }`}
                            />
                          </Button>
                          <span className="text-micro uppercase tracking-caps text-ink-text">
                            {publicViewStatusLabel}
                          </span>
                        </div>
                        <MatrixButton
                          onClick={handleCopyPublicView}
                          disabled={!publicViewEnabled || publicViewBusy}
                          className="px-3 py-2 text-micro normal-case"
                        >
                          {publicViewCopyButtonLabel}
                        </MatrixButton>
                      </div>
                    </div>
                  </AsciiBox>
                ) : null}

                {!screenshotMode ? (
                  <TrendMonitor
                    rows={trendRowsForDisplay}
                    from={trendFromForDisplay}
                    to={trendToForDisplay}
                    period={period}
                    timeZoneLabel={trendTimeZoneLabel}
                    showTimeZoneLabel={false}
                    className="h-auto min-h-[280px]"
                  />
                ) : null}

                {activityHeatmapBlock}
                {screenshotMode ? (
                  <div
                    className="mt-4 flex flex-col items-center gap-2"
                    data-screenshot-exclude="true"
                    style={isCapturing ? { display: "none" } : undefined}
                  >
                    <MatrixButton
                      type="button"
                      onClick={handleShareToX}
                      aria-label={screenshotTwitterLabel}
                      title={screenshotTwitterLabel}
                      className="h-12 md:h-14 px-6 text-body tracking-caps"
                      primary
                      disabled={isCapturing}
                    >
                      {screenshotTwitterButton}
                    </MatrixButton>
                    <span className="text-micro uppercase tracking-caps text-ink-text">
                      {screenshotTwitterHint}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
                {projectUsageBlock}

                <UsagePanel
                  title={copy("usage.panel.title")}
                  period={period}
                  periods={periodsForDisplay}
                  onPeriodChange={setSelectedPeriod}
                  metrics={metricsRows}
                  showSummary={period === "total"}
                  useSummaryLayout
                  summaryLabel={summaryLabel}
                  summaryValue={summaryValue}
                  summaryCostValue={summaryCostValue}
                  onCostInfo={costInfoEnabled ? openCostModal : null}
                  breakdownCollapsed={allowBreakdownToggle ? coreIndexCollapsed : true}
                  onToggleBreakdown={
                    allowBreakdownToggle ? () => setCoreIndexCollapsed((value) => !value) : null
                  }
                  collapseLabel={allowBreakdownToggle ? coreIndexCollapseLabel : undefined}
                  expandLabel={allowBreakdownToggle ? coreIndexExpandLabel : undefined}
                  collapseAriaLabel={allowBreakdownToggle ? coreIndexCollapseAria : undefined}
                  expandAriaLabel={allowBreakdownToggle ? coreIndexExpandAria : undefined}
                  onRefresh={screenshotMode ? null : refreshAll}
                  loading={usagePanelLoading}
                  refreshing={usagePanelRefreshing}
                  error={usageError}
                  rangeLabel={screenshotMode ? null : rangeLabel}
                  rangeTimeZoneLabel={timeZoneRangeLabel}
                  statusLabel={screenshotMode ? null : usageSourceLabel}
                  summaryScrambleDurationMs={identityScrambleDurationMs}
                  summaryAnimate={false}
                />

                <NeuralDivergenceMap fleetData={fleetData} className="min-w-0" footer={null} />

                {!screenshotMode ? (
                  <AsciiBox
                    title={copy("dashboard.daily.title")}
                    subtitle={copy("dashboard.daily.subtitle")}
                  >
                    {!hasDetailsActual ? (
                      <div className="text-micro opacity-40 mb-2">
                        {dailyEmptyPrefix}
                        <code className="px-1 py-0.5 bg-surface/40 border border-ink-line">
                          {installSyncCmd}
                        </code>
                        {dailyEmptySuffix}
                      </div>
                    ) : null}
                    <div
                      className="overflow-auto max-h-[520px] border border-ink-faint"
                      role="region"
                      aria-label={copy("daily.table.aria_label")}
                      tabIndex={0}
                    >
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-surface/90">
                          <tr className="border-b border-ink-faint">
                            {detailsColumns.map((c) => (
                              <th
                                key={c.key}
                                aria-sort={ariaSortFor(c.key)}
                                className="text-left p-0"
                              >
                                <Button
                                  type="button"
                                  onClick={() => toggleSort(c.key)}
                                  title={c.title}
                                  className="w-full px-3 py-2 text-left text-micro uppercase tracking-caps font-black opacity-70 hover:opacity-100 hover:bg-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-muted flex items-center justify-start"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span>{c.label}</span>
                                    <span className="opacity-40">{sortIconFor(c.key)}</span>
                                  </span>
                                </Button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedDetails.map((r) => (
                            <tr
                              key={String(
                                r?.[detailsDateKey] || r?.day || r?.hour || r?.month || "",
                              )}
                              className={`border-b border-ink-faint hover:bg-ink-faint ${
                                r.missing
                                  ? "text-ink-muted"
                                  : r.future
                                    ? "text-ink-muted"
                                    : ""
                              }`}
                            >
                              <td className="px-3 py-2 text-data opacity-80 font-mono">
                                {renderDetailDate(r)}
                              </td>
                              <td className="px-3 py-2 text-data font-mono">
                                {renderDetailCell(r, "total_tokens")}
                              </td>
                              <td className="px-3 py-2 text-data font-mono">
                                {renderDetailCell(r, "input_tokens")}
                              </td>
                              <td className="px-3 py-2 text-data font-mono">
                                {renderDetailCell(r, "output_tokens")}
                              </td>
                              <td className="px-3 py-2 text-data font-mono">
                                {renderDetailCell(r, "cached_input_tokens")}
                              </td>
                              <td className="px-3 py-2 text-data font-mono">
                                {renderDetailCell(r, "reasoning_output_tokens")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {DETAILS_PAGED_PERIODS.has(period) && detailsPageCount > 1 ? (
                      <div className="flex items-center justify-between mt-3 text-micro uppercase tracking-caps font-black">
                        <MatrixButton
                          type="button"
                          onClick={() => setDetailsPage((prev) => Math.max(0, prev - 1))}
                          disabled={detailsPage === 0}
                        >
                          {copy("details.pagination.prev")}
                        </MatrixButton>
                        <span className="opacity-50">
                          {copy("details.pagination.page", {
                            page: detailsPage + 1,
                            total: detailsPageCount,
                          })}
                        </span>
                        <MatrixButton
                          type="button"
                          onClick={() =>
                            setDetailsPage((prev) => Math.min(detailsPageCount - 1, prev + 1))
                          }
                          disabled={detailsPage + 1 >= detailsPageCount}
                        >
                          {copy("details.pagination.next")}
                        </MatrixButton>
                      </div>
                    ) : null}
                  </AsciiBox>
                ) : null}
              </div>
            </div>
          </>
        )}
      </MatrixShell>
      <CostAnalysisModal isOpen={costModalOpen} onClose={closeCostModal} fleetData={fleetData} />
    </>
  );
}
