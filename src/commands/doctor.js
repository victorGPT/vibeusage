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
  runAudit: runClaudeAudit,
} = require("../lib/ops/audit-claude");

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
  let result;
  try {
    result = runClaudeAudit({
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
    `Claude token audit (last ${result.days} days, window >= ${result.windowStartIso})\n`,
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

function parseArgs(argv) {
  const out = {
    json: false,
    out: null,
    baseUrl: null,
    auditTokens: false,
    auditDays: AUDIT_DEFAULT_DAYS,
    auditThreshold: AUDIT_DEFAULT_THRESHOLD,
    auditDbJson: null,
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
    else throw new Error(`Unknown option: ${arg}`);
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
