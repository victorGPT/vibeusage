const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadShouldShowInstallCard() {
  const modulePath = path.join(__dirname, "..", "dashboard", "src", "lib", "install-status.js");
  const mod = await import(pathToFileURL(modulePath).href);
  return mod.shouldShowInstallCard;
}

test("active token hides install card when activeDays is zero", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();
  const actual = shouldShowInstallCard({
    publicMode: false,
    screenshotMode: false,
    forceInstall: false,
    accessEnabled: true,
    heatmapLoading: false,
    activeDays: 0,
    hasActiveDeviceToken: true,
  });
  assert.equal(actual, false);
});

test("forceInstall shows install card even with active token", async () => {
  const shouldShowInstallCard = await loadShouldShowInstallCard();
  const actual = shouldShowInstallCard({
    publicMode: false,
    screenshotMode: false,
    forceInstall: true,
    accessEnabled: true,
    heatmapLoading: false,
    activeDays: 0,
    hasActiveDeviceToken: true,
  });
  assert.equal(actual, true);
});

async function loadShouldShowEmptyState() {
  const modulePath = path.join(__dirname, "..", "dashboard", "src", "lib", "install-status.js");
  const mod = await import(pathToFileURL(modulePath).href);
  return mod.shouldShowEmptyState;
}

const installedQuietWeek = {
  publicMode: false,
  accessEnabled: true,
  heatmapLoading: false,
  activeDays: 0,
  hasActiveDeviceToken: true,
};

test("empty state shows only while the installed device has never synced", async () => {
  const shouldShowEmptyState = await loadShouldShowEmptyState();
  assert.equal(shouldShowEmptyState({ ...installedQuietWeek, latestDeviceSeenAt: null }), true);
});

test("a device that synced before keeps the readout even when the heatmap shows no activity", async () => {
  const shouldShowEmptyState = await loadShouldShowEmptyState();
  assert.equal(
    shouldShowEmptyState({ ...installedQuietWeek, latestDeviceSeenAt: "2025-06-01T00:00:00Z" }),
    false,
  );
});

test("empty state waits for the heatmap and never shows on a public page", async () => {
  const shouldShowEmptyState = await loadShouldShowEmptyState();
  assert.equal(shouldShowEmptyState({ ...installedQuietWeek, heatmapLoading: true }), false);
  assert.equal(shouldShowEmptyState({ ...installedQuietWeek, publicMode: true }), false);
  assert.equal(shouldShowEmptyState({ ...installedQuietWeek, activeDays: 3 }), false);
});

test("a token the server saw in use also keeps the readout, even if the device row was never touched", async () => {
  const shouldShowEmptyState = await loadShouldShowEmptyState();
  assert.equal(
    shouldShowEmptyState({ ...installedQuietWeek, latestDeviceSeenAt: null, latestTokenActivityAt: "2025-06-01T00:00:00Z" }),
    false,
  );
});
