const os = require("node:os");
const path = require("node:path");

const { readJsonStrict, writeFileAtomic, chmod600IfPossible } = require("../lib/fs");
const { resolveTrackerPaths } = require("../lib/tracker-paths");
const { collectTrackerDiagnostics } = require("../lib/diagnostics");
const { resolveRuntimeConfig } = require("../lib/runtime-config");
const { buildDoctorReport } = require("../lib/doctor");
const {
  DEFAULT_DAYS: AUDIT_DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT: AUDIT_DEFAULT_THRESHOLD,
  runSourceAudit,
  getStrategy: getAuditStrategy,
  listRegisteredSources,
} = require("../lib/ops/audit-source");

async function cmdDoctor(argv = []) {
  const opts = parseArgs(argv);
  const home = os.homedir();
  const { trackerDir } = await resolveTrackerPaths({ home });
  const configPath = path.join(trackerDir, "config.json");

  const configStatus = await readJsonStrict(configPath);
  const config =
    configStatus.status === "ok" && isPlainObject(configStatus.value) ? configStatus.value : {};

  if (opts.auditTokens) {
    return runAuditTokens({ opts, config });
  }

  const runtime = resolveRuntimeConfig({
    cli: { baseUrl: opts.baseUrl },
    config,
    env: process.env,
  });
  const diagnostics = await collectTrackerDiagnostics({ home });
  const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

  const report = await buildDoctorReport({
    runtime,
    diagnostics,
    fetch: globalThis.fetch,
    paths: {
      trackerDir,
      configPath,
      cliPath,
    },
  });

  const jsonOutput = opts.json || Boolean(opts.out);
  const payload = JSON.stringify(report, null, jsonOutput ? 2 : 0) + "\n";

  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out);
    await writeFileAtomic(outPath, payload);
    await chmod600IfPossible(outPath);
    process.stderr.write(`Wrote doctor report to: ${outPath}\n`);
  }

  if (jsonOutput) {
    process.stdout.write(payload);
  } else {
    process.stdout.write(renderHumanReport(report));
  }

  if (report.summary.critical > 0) {
    process.exitCode = 1;
  }
}

function runAuditTokens({ opts, config }) {
  const sourceId = opts.auditSource || "claude";
  if (sourceId === "all") {
    return runAuditTokensAll({ opts, config });
  }
  const strategy = getAuditStrategy(sourceId);
  if (!strategy) {
    const registered = ["all", ...listRegisteredSources()].join(", ");
    const message = `unknown --source '${sourceId}'. Registered: ${registered}.`;
    if (opts.json) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: "unknown-source", message })}\n`);
    } else {
      process.stderr.write(`doctor --audit-tokens: ${message}\n`);
    }
    process.exitCode = 2;
    return;
  }

  let result;
  try {
    result = runSourceAudit({
      strategy,
      days: opts.auditDays,
      threshold: opts.auditThreshold,
      deviceId: config.deviceId || null,
      dbJsonPath: opts.auditDbJson || null,
    });
  } catch (err) {
    const message = err?.message || String(err);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: "audit-error", message })}\n`);
    } else {
      process.stderr.write(`doctor --audit-tokens: ${message}\n`);
    }
    process.exitCode = 2;
    return;
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 2;
    else if (result.exceedsThreshold) process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    process.stderr.write(`doctor --audit-tokens: ${result.message || result.error}\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write(
    `${result.displayName || result.source} token audit (last ${result.days} days, window >= ${result.windowStartIso})\n`,
  );
  process.stdout.write(
    `Scanned ${result.filesScanned} .jsonl files, ${formatNumber(result.usageLines)} usage lines, ` +
      `${formatNumber(result.uniqueMessages)} unique message.ids, ` +
      `${formatNumber(result.duplicatesSkipped)} duplicates skipped.\n\n`,
  );
  process.stdout.write(
    `${"day".padEnd(12)}  ${"truth".padStart(15)}  ${"db".padStart(15)}  ${"ratio".padStart(8)}  ${"drift".padStart(8)}\n`,
  );
  process.stdout.write(`${"-".repeat(66)}\n`);
  for (const r of result.rows) {
    const ratio = r.ratio == null ? "—" : `${r.ratio.toFixed(3)}x`;
    const drift = r.driftPct == null ? "—" : `${r.driftPct.toFixed(1)}%`;
    process.stdout.write(
      `${r.day.padEnd(12)}  ${formatNumber(r.truth).padStart(15)}  ` +
        `${formatNumber(r.db).padStart(15)}  ${ratio.padStart(8)}  ${drift.padStart(8)}\n`,
    );
  }
  process.stdout.write(
    `\nMax drift: ${result.maxDriftPct.toFixed(2)}% (threshold ${result.thresholdPct}%).\n`,
  );

  if (result.exceedsThreshold) {
    process.stderr.write(
      `\nFAIL drift ${result.maxDriftPct.toFixed(2)}% exceeds threshold ${result.thresholdPct}%.\n` +
        `If vibeusage >= 0.5.0, scrub the Claude/OpenCode cursor block in\n` +
        `~/.vibeusage/tracker/cursors.json and rerun \`vibeusage sync --drain\`.\n`,
    );
    process.exitCode = 1;
  }
}

function runAuditTokensAll({ opts, config }) {
  const ids = listRegisteredSources();
  const perSource = [];
  let anyExceeds = false;
  let anyHardError = false;

  for (const id of ids) {
    const strategy = getAuditStrategy(id);
    let result;
    try {
      result = runSourceAudit({
        strategy,
        days: opts.auditDays,
        threshold: opts.auditThreshold,
        deviceId: config.deviceId || null,
        // --db-json is source-specific so we skip it under --source=all; the
        // only sane paths are insforge auto-mode or no-local-sessions.
      });
    } catch (err) {
      result = { ok: false, source: id, error: "audit-error", message: err?.message || String(err) };
      anyHardError = true;
    }
    if (result.ok && result.exceedsThreshold) anyExceeds = true;
    // no-local-sessions is informational, not a hard error; other non-ok states
    // (cannot-resolve-user-id, insforge-db-query-failed, etc.) count as errors.
    if (!result.ok && result.error !== "no-local-sessions") anyHardError = true;
    perSource.push(result);
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: !anyHardError, thresholdPct: opts.auditThreshold, days: opts.auditDays, sources: perSource }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(
      `Token audit across all registered sources (last ${opts.auditDays} days)\n\n`,
    );
    process.stdout.write(
      `${"source".padEnd(12)}  ${"status".padEnd(22)}  ${"max drift".padStart(10)}  ${"files".padStart(6)}  ${"events".padStart(6)}\n`,
    );
    process.stdout.write(`${"-".repeat(70)}\n`);
    for (const r of perSource) {
      if (r.ok) {
        const statusText = r.exceedsThreshold
          ? `FAIL > ${opts.auditThreshold}%`
          : `ok`;
        const drift = `${r.maxDriftPct.toFixed(1)}%`;
        process.stdout.write(
          `${r.source.padEnd(12)}  ${statusText.padEnd(22)}  ${drift.padStart(10)}  ${String(r.filesScanned).padStart(6)}  ${String(r.usageLines).padStart(6)}\n`,
        );
      } else {
        const statusText =
          r.error === "no-local-sessions" ? "no local sessions" : `ERR ${r.error}`;
        process.stdout.write(
          `${r.source.padEnd(12)}  ${statusText.padEnd(22)}  ${"—".padStart(10)}  ${"—".padStart(6)}  ${"—".padStart(6)}\n`,
        );
      }
    }
    process.stdout.write(
      `\nThreshold ${opts.auditThreshold}%. ` +
        (anyExceeds
          ? `At least one source exceeds threshold — rerun \`vibeusage doctor --audit-tokens --source <id>\` for details.\n`
          : `All sources within threshold.\n`),
    );
  }

  if (anyHardError) process.exitCode = 2;
  else if (anyExceeds) process.exitCode = 1;
}

function parseArgs(argv) {
  const out = {
    json: false,
    out: null,
    baseUrl: null,
    auditTokens: false,
    auditDays: AUDIT_DEFAULT_DAYS,
    auditThreshold: AUDIT_DEFAULT_THRESHOLD,
    auditDbJson: null,
    auditSource: "claude",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") out.json = true;
    else if (arg === "--out") out.out = argv[++i] || null;
    else if (arg === "--base-url") out.baseUrl = argv[++i] || null;
    else if (arg === "--audit-tokens") out.auditTokens = true;
    else if (arg === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--days expects a positive number`);
      out.auditDays = Math.floor(n);
    } else if (arg === "--threshold") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`--threshold expects a non-negative number`);
      out.auditThreshold = n;
    } else if (arg === "--db-json") out.auditDbJson = argv[++i] || null;
    else if (arg === "--source") {
      const raw = argv[++i];
      if (!raw) throw new Error(`--source expects a value`);
      out.auditSource = String(raw).trim().toLowerCase();
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return out;
}

function renderHumanReport(report) {
  const lines = [];
  lines.push("Doctor report");
  lines.push("");
  for (const check of report.checks || []) {
    lines.push(formatCheckLine(check));
  }
  lines.push("");
  lines.push(
    `Summary: ok ${report.summary.ok} | warn ${report.summary.warn} | fail ${report.summary.fail} | critical ${report.summary.critical}`,
  );
  lines.push("");
  return lines.join("\n");
}

function formatCheckLine(check = {}) {
  const status = String(check.status || "unknown").toUpperCase();
  const detail = check.detail ? ` - ${check.detail}` : "";
  return `- [${status}] ${check.id || "unknown"}${detail}`;
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

module.exports = { cmdDoctor };
