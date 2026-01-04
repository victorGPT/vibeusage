function stripDebugFlag(argv, env = process.env) {
  const filtered = Array.isArray(argv) ? argv.filter((arg) => arg !== '--debug') : [];
  const debugEnv =
    String(env?.VIBEUSAGE_DEBUG || '') === '1' ||
    String(env?.VIBESCORE_DEBUG || '') === '1';
  return { argv: filtered, debug: filtered.length !== (argv || []).length || debugEnv };
}

module.exports = { stripDebugFlag };
