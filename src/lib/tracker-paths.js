const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

async function resolveTrackerPaths({ home = os.homedir(), migrate = true } = {}) {
  const legacyRootDir = path.join(home, '.vibescore');
  const rootDir = path.join(home, '.vibeusage');
  const legacyTrackerDir = path.join(legacyRootDir, 'tracker');
  const legacyBinDir = path.join(legacyRootDir, 'bin');
  const trackerDir = path.join(rootDir, 'tracker');
  const binDir = path.join(rootDir, 'bin');

  const legacyExists = await pathExists(legacyRootDir);
  const newExists = await pathExists(rootDir);

  let usingLegacy = false;
  let migrated = false;

  if (migrate && legacyExists && !newExists) {
    const result = await migrateLegacyRoot({ legacyRootDir, rootDir });
    usingLegacy = result.usingLegacy;
    migrated = result.migrated;
  } else if (!newExists && legacyExists) {
    usingLegacy = true;
  }

  const activeRootDir = usingLegacy ? legacyRootDir : rootDir;
  return {
    rootDir: activeRootDir,
    trackerDir: path.join(activeRootDir, 'tracker'),
    binDir: path.join(activeRootDir, 'bin'),
    legacyRootDir,
    legacyTrackerDir,
    legacyBinDir,
    migrated,
    usingLegacy
  };
}

async function migrateLegacyRoot({ legacyRootDir, rootDir }) {
  try {
    await fs.rename(legacyRootDir, rootDir);
    return { migrated: true, usingLegacy: false };
  } catch (err) {
    try {
      await fs.cp(legacyRootDir, rootDir, { recursive: true });
      return { migrated: true, usingLegacy: false };
    } catch (copyErr) {
      return { migrated: false, usingLegacy: true, error: copyErr };
    }
  }
}

async function pathExists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

module.exports = {
  resolveTrackerPaths
};
