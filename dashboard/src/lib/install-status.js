export function shouldShowInstallCard({
  publicMode,
  screenshotMode,
  forceInstall,
  accessEnabled,
  heatmapLoading,
  activeDays,
  hasActiveDeviceToken,
} = {}) {
  if (publicMode || screenshotMode) return false;
  if (forceInstall) return true;
  return accessEnabled && !heatmapLoading && activeDays === 0 && !hasActiveDeviceToken;
}

// A quiet week or year is not "no data": only a device that never synced is.
export function shouldShowEmptyState({
  publicMode,
  accessEnabled,
  heatmapLoading,
  activeDays,
  hasActiveDeviceToken,
  latestDeviceSeenAt,
} = {}) {
  if (publicMode) return false;
  return (
    accessEnabled && !heatmapLoading && activeDays === 0 && hasActiveDeviceToken && !latestDeviceSeenAt
  );
}
