#!/usr/bin/env node
/* eslint-disable no-console */

const { run } = require('../src/cli');

const { argv, debug } = stripDebugFlag(process.argv.slice(2));
if (debug) process.env.VIBESCORE_DEBUG = '1';

run(argv).catch((err) => {
  console.error(err?.stack || String(err));
  if (debug) {
    const original = err?.originalMessage;
    if (original && original !== err?.message) {
      console.error(`Original error: ${original}`);
    }
  }
  process.exitCode = 1;
});

function stripDebugFlag(argv) {
  const filtered = argv.filter((arg) => arg !== '--debug');
  return { argv: filtered, debug: filtered.length !== argv.length || process.env.VIBESCORE_DEBUG === '1' };
}
