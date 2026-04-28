"use strict";

const path = require("node:path");

// scrubSourceCursors clears every cursor field that, if left in place, would
// cause a re-parse of a source's session files to *accumulate* into
// previously-uploaded buckets instead of *rebuilding* them from scratch.
//
// This is the helper that fixes the bug behind the recent "DB tokens doubled"
// incident: clearing only `cursors.files` causes the parser to re-read the
// jsonl files and add their token totals on top of whatever was still cached
// in `cursors.hourly.buckets`. The result is buckets at roughly 2x the
// ground truth.
//
// Four cursor surfaces must be cleared in lockstep for a source rebuild to
// be correct:
//   1. cursors.files entries whose path lives under that source's session
//      root (so the parser re-reads each file from offset 0).
//   2. cursors.hourly.buckets keyed `<source>|<model>|<hour>` (so per-bucket
//      totals restart at zero before re-aggregation).
//   3. cursors.hourly.groupQueued keys for that source (so the next sync
//      re-enqueues each touched bucket to queue.jsonl for upload).
//   4. cursors.projectHourly.buckets keyed `<project>|<source>|<hour>`
//      (project-scoped totals are aggregated independently from the global
//      hourly state and would otherwise stay doubled in the dashboard's
//      per-project views).
//
// `cursors.projectHourly.projects` holds project metadata (git remotes,
// display names) and is intentionally preserved — it carries no token
// totals, just identity.
//
// Sources that don't use `cursors.files` (sqlite-backed opencode, ledger-
// backed hermes/openclaw) carry their progress in dedicated cursor fields;
// those are reset directly.

const SOURCES = {
  claude: {
    sessionRoot: ({ home }) => path.join(home, ".claude", "projects"),
  },
  codex: {
    sessionRoot: ({ home, env }) =>
      path.join(env.CODEX_HOME || path.join(home, ".codex"), "sessions"),
  },
  "every-code": {
    sessionRoot: ({ home, env }) =>
      path.join(env.CODE_HOME || path.join(home, ".code"), "sessions"),
  },
  gemini: {
    sessionRoot: ({ home, env }) =>
      path.join(env.GEMINI_HOME || path.join(home, ".gemini"), "tmp"),
  },
  kimi: {
    sessionRoot: ({ home, env }) =>
      path.join(env.KIMI_HOME || path.join(home, ".kimi"), "sessions"),
  },
  opencode: {
    extraCursorKeys: ["opencode", "opencodeSqlite"],
  },
  hermes: {
    extraCursorKeys: ["hermesLedger"],
  },
  openclaw: {
    extraCursorKeys: ["openclawLedger"],
  },
};

function listSupportedSources() {
  return Object.keys(SOURCES);
}

function scrubSourceCursors({ cursors, sourceId, home, env = process.env }) {
  if (!cursors || typeof cursors !== "object") {
    throw new Error("scrubSourceCursors: cursors must be an object");
  }
  const config = SOURCES[sourceId];
  if (!config) {
    throw new Error(
      `scrubSourceCursors: unknown sourceId '${sourceId}'. Supported: ${listSupportedSources().join(", ")}`,
    );
  }

  const result = {
    sourceId,
    filesRemoved: 0,
    bucketsRemoved: 0,
    groupsRemoved: 0,
    projectBucketsRemoved: 0,
    extraCursorsCleared: [],
  };

  // 1) cursors.files — strip every entry whose path lives under this source's
  // session root, so the parser re-reads them from byte 0.
  if (config.sessionRoot && cursors.files && typeof cursors.files === "object") {
    const prefix = config.sessionRoot({ home, env });
    for (const key of Object.keys(cursors.files)) {
      if (typeof key !== "string") continue;
      if (key.startsWith(prefix)) {
        delete cursors.files[key];
        result.filesRemoved += 1;
      }
    }
  }

  // 2) cursors.hourly.buckets — strip every bucket keyed for this source so
  // its totals restart at zero before re-aggregation.
  if (cursors.hourly && typeof cursors.hourly === "object") {
    const bucketPrefix = `${sourceId}|`;
    if (cursors.hourly.buckets && typeof cursors.hourly.buckets === "object") {
      for (const key of Object.keys(cursors.hourly.buckets)) {
        if (typeof key === "string" && key.startsWith(bucketPrefix)) {
          delete cursors.hourly.buckets[key];
          result.bucketsRemoved += 1;
        }
      }
    }
    // 3) cursors.hourly.groupQueued — strip per-source enqueue records so
    // the next sync re-enqueues each touched bucket for upload.
    if (cursors.hourly.groupQueued && typeof cursors.hourly.groupQueued === "object") {
      for (const key of Object.keys(cursors.hourly.groupQueued)) {
        if (typeof key === "string" && key.startsWith(bucketPrefix)) {
          delete cursors.hourly.groupQueued[key];
          result.groupsRemoved += 1;
        }
      }
    }
  }

  // 4) cursors.projectHourly.buckets — keyed `<project_key>|<source>|<hour>`.
  // Strip the buckets where the middle segment matches this source, leaving
  // every other source's project-scoped totals (and the projects metadata
  // map) untouched.
  if (
    cursors.projectHourly &&
    typeof cursors.projectHourly === "object" &&
    cursors.projectHourly.buckets &&
    typeof cursors.projectHourly.buckets === "object"
  ) {
    for (const key of Object.keys(cursors.projectHourly.buckets)) {
      if (typeof key !== "string") continue;
      const parts = key.split("|");
      if (parts.length >= 2 && parts[1] === sourceId) {
        delete cursors.projectHourly.buckets[key];
        result.projectBucketsRemoved += 1;
      }
    }
  }

  // 5) Source-specific top-level cursor fields (opencode sqlite progress,
  // hermes/openclaw ledger offsets). Resetting these is what makes a
  // rebuild work for non-file sources.
  for (const key of config.extraCursorKeys || []) {
    if (key in cursors) {
      delete cursors[key];
      result.extraCursorsCleared.push(key);
    }
  }

  return result;
}

module.exports = {
  scrubSourceCursors,
  listSupportedSources,
};
