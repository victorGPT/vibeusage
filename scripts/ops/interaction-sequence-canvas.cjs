"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_CONFIG = {
  version: 1,
  max_scenarios: 3,
  pin: ["tracker-sync-ingest"],
  exclude: [],
  labels: {},
};

const GROUP_PADDING = 24;
const GROUP_GAP_Y = 80;
const LIFELINE_WIDTH = 180;
const LIFELINE_HEIGHT = 90;
const LIFELINE_GAP = 120;
const MESSAGE_WIDTH = 340;
const MESSAGE_HEIGHT = 50;
const MESSAGE_GAP = 70;
const MESSAGE_START_Y = 160;

const SCENARIO_CATALOG = [
  {
    id: "tracker-sync-ingest",
    title: "Tracker Sync -> Ingest",
    weight: 100,
    requiredPaths: [
      "src/commands/sync.js",
      "src/lib/rollout.js",
      "src/lib/uploader.js",
      "src/lib/vibeusage-api.js",
      "insforge-src/functions-esm/vibeusage-ingest.js",
    ],
    optionalPaths: ["insforge-src/functions-esm/vibeusage-sync-ping.js"],
    lifelines: [
      {
        id: "cli-user",
        name: "CLI User",
        subtitle: "tracker sync",
        notes: "Starts a manual sync run.",
        color: "6",
      },
      {
        id: "tracker-sync",
        name: "Tracker Sync",
        subtitle: "cmdSync()",
        notes: "Orchestrates parsing and upload.",
        color: "2",
      },
      {
        id: "local-storage",
        name: "Local Storage",
        subtitle: "~/.vibeusage + logs",
        notes: "Queue, cursors, session files.",
        color: "5",
      },
      {
        id: "uploader",
        name: "Uploader",
        subtitle: "drainQueueToCloud()",
        notes: "Batches hourly aggregates.",
        color: "3",
      },
      {
        id: "edge",
        name: "InsForge Edge",
        subtitle: "vibeusage-ingest",
        notes: "Validates token and writes usage.",
        color: "4",
      },
      {
        id: "db",
        name: "InsForge DB",
        subtitle: "vibeusage_tracker_*",
        notes: "Idempotent upserts + metrics.",
        color: "4",
      },
    ],
    messages: [
      {
        from: "cli-user",
        to: "tracker-sync",
        action: "tracker sync",
        params: "argv",
        summary: "Start sync and acquire lock.",
      },
      {
        from: "tracker-sync",
        to: "local-storage",
        action: "read config + cursors",
        summary: "Load device token and state.",
      },
      {
        from: "tracker-sync",
        to: "local-storage",
        action: "parse session logs",
        summary: "Aggregate 30-min buckets into queue.",
      },
      {
        from: "tracker-sync",
        to: "uploader",
        action: "drainQueueToCloud",
        params: "queue.jsonl",
        summary: "Begin batch upload.",
      },
      {
        from: "uploader",
        to: "local-storage",
        action: "readBatch",
        params: "queue.jsonl",
        summary: "Deduplicate buckets per hour.",
      },
      {
        from: "uploader",
        to: "edge",
        action: "POST /functions/vibeusage-ingest",
        summary: "Send hourly aggregates (idempotent).",
      },
      {
        from: "edge",
        to: "db",
        action: "select token + upsert hourly",
        summary: "Validate device token and write rows.",
      },
      {
        from: "db",
        to: "edge",
        action: "rows upserted",
        summary: "Return inserted/skipped counts.",
      },
      {
        from: "edge",
        to: "uploader",
        action: "ingest response",
        summary: "Edge function returns success.",
      },
      {
        from: "uploader",
        to: "tracker-sync",
        action: "uploadResult",
        summary: "Update throttle state and offsets.",
      },
      {
        from: "tracker-sync",
        to: "edge",
        action: "POST /functions/vibeusage-sync-ping",
        summary: "Best-effort heartbeat.",
      },
      {
        from: "tracker-sync",
        to: "cli-user",
        action: "print summary",
        summary: "Report parsed/inserted/pending counts.",
      },
    ],
  },
  {
    id: "link-code-exchange",
    title: "Link Code Exchange",
    weight: 80,
    requiredPaths: [
      "src/commands/init.js",
      "insforge-src/functions-esm/vibeusage-link-code-init.js",
      "insforge-src/functions-esm/vibeusage-link-code-exchange.js",
      "src/lib/vibeusage-api.js",
    ],
    optionalPaths: [],
    lifelines: [
      {
        id: "cli-user",
        name: "CLI User",
        subtitle: "tracker init",
        notes: "Starts auth setup.",
        color: "6",
      },
      {
        id: "tracker-init",
        name: "Tracker Init",
        subtitle: "cmdInit()",
        notes: "Handles link code flow.",
        color: "2",
      },
      {
        id: "edge",
        name: "InsForge Edge",
        subtitle: "link-code-*",
        notes: "Issues and exchanges codes.",
        color: "4",
      },
      {
        id: "db",
        name: "InsForge DB",
        subtitle: "link codes + tokens",
        notes: "Persists auth state.",
        color: "4",
      },
    ],
    messages: [
      {
        from: "cli-user",
        to: "tracker-init",
        action: "tracker init",
        summary: "Begin link-code auth flow.",
      },
      {
        from: "tracker-init",
        to: "edge",
        action: "POST /functions/vibeusage-link-code-init",
        summary: "Request a short-lived link code.",
      },
      {
        from: "edge",
        to: "db",
        action: "insert link code",
        summary: "Store issued code with expiry.",
      },
      {
        from: "db",
        to: "edge",
        action: "link code issued",
        summary: "Return code + request_id.",
      },
      {
        from: "edge",
        to: "tracker-init",
        action: "link code response",
        summary: "Provide code for browser auth.",
      },
      {
        from: "tracker-init",
        to: "edge",
        action: "POST /functions/vibeusage-link-code-exchange",
        summary: "Exchange code for device token.",
      },
      {
        from: "edge",
        to: "db",
        action: "create device token",
        summary: "Persist device token hash.",
      },
      {
        from: "db",
        to: "edge",
        action: "device token row",
        summary: "Return token + device id.",
      },
      {
        from: "edge",
        to: "tracker-init",
        action: "device token response",
        summary: "CLI stores token locally.",
      },
      {
        from: "tracker-init",
        to: "cli-user",
        action: "print connect instructions",
        summary: "Guide user to finish setup.",
      },
    ],
  },
  {
    id: "usage-summary-query",
    title: "Usage Summary Query",
    weight: 70,
    requiredPaths: [
      "dashboard/src/lib/vibeusage-api.js",
      "dashboard/src/lib/insforge-client.js",
      "insforge-src/functions-esm/vibeusage-usage-summary.js",
    ],
    optionalPaths: [],
    lifelines: [
      {
        id: "dashboard-ui",
        name: "Dashboard UI",
        subtitle: "DashboardPage",
        notes: "Requests usage totals.",
        color: "6",
      },
      {
        id: "dashboard-api",
        name: "Dashboard API",
        subtitle: "getUsageSummary()",
        notes: "Builds query + auth.",
        color: "2",
      },
      {
        id: "edge",
        name: "InsForge Edge",
        subtitle: "vibeusage-usage-summary",
        notes: "Aggregates usage totals.",
        color: "4",
      },
      {
        id: "db",
        name: "InsForge DB",
        subtitle: "vibeusage_tracker_hourly",
        notes: "Serves aggregate rows.",
        color: "4",
      },
    ],
    messages: [
      {
        from: "dashboard-ui",
        to: "dashboard-api",
        action: "getUsageSummary",
        params: "from,to",
        summary: "Request totals for selected range.",
      },
      {
        from: "dashboard-api",
        to: "edge",
        action: "GET /functions/vibeusage-usage-summary",
        summary: "Fetch aggregated usage totals.",
      },
      {
        from: "edge",
        to: "db",
        action: "select aggregates",
        summary: "Load totals for range.",
      },
      {
        from: "db",
        to: "edge",
        action: "rows + totals",
        summary: "Return data for response.",
      },
      {
        from: "edge",
        to: "dashboard-api",
        action: "usage summary response",
        summary: "Return totals + metadata.",
      },
      {
        from: "dashboard-api",
        to: "dashboard-ui",
        action: "render totals",
        summary: "Update dashboard metrics.",
      },
    ],
  },
];

function parseArgs(argv) {
  const out = { root: null, out: null, config: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      out.help = true;
    } else if (arg === "--root") {
      out.root = argv[i + 1];
      i += 1;
    } else if (arg === "--out") {
      out.out = argv[i + 1];
      i += 1;
    } else if (arg === "--config") {
      out.config = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/ops/interaction-sequence-canvas.cjs [--root <path>] [--out <path>] [--config <path>]",
      "",
      "Options:",
      "  --root <path>    Scan root (default: cwd)",
      "  --out <path>     Output path (default: <root>/interaction_sequence.canvas)",
      "  --config <path>  Config path (default: <root>/interaction_sequence.config.json)",
      "",
    ].join("\n"),
  );
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (_err) {
    return false;
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeLabels(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      out[key] = entry.trim();
    }
  }
  return out;
}

function normalizeMaxScenarios(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.max(1, Math.min(7, Math.floor(n)));
  return clamped;
}

async function loadConfig({ rootDir, configPath }) {
  const resolvedPath = configPath
    ? path.resolve(configPath)
    : path.join(rootDir, "interaction_sequence.config.json");

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw);
    const pin = normalizeStringArray(parsed.pin);
    const exclude = normalizeStringArray(parsed.exclude);
    const labels = normalizeLabels(parsed.labels);
    const maxScenarios = normalizeMaxScenarios(parsed.max_scenarios, DEFAULT_CONFIG.max_scenarios);

    return {
      path: resolvedPath,
      config: {
        version: DEFAULT_CONFIG.version,
        max_scenarios: maxScenarios,
        pin: pin.length > 0 ? pin : DEFAULT_CONFIG.pin.slice(),
        exclude,
        labels,
      },
    };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return {
        path: resolvedPath,
        config: { ...DEFAULT_CONFIG, pin: DEFAULT_CONFIG.pin.slice(), exclude: [], labels: {} },
      };
    }
    return {
      path: resolvedPath,
      config: { ...DEFAULT_CONFIG, pin: DEFAULT_CONFIG.pin.slice(), exclude: [], labels: {} },
    };
  }
}

async function resolveScenarioAvailability(rootDir, scenario) {
  const required = scenario.requiredPaths || [];
  for (const relPath of required) {
    const fullPath = path.join(rootDir, relPath);
    if (!(await fileExists(fullPath))) return { ok: false, score: 0 };
  }

  let score = Number(scenario.weight || 0);
  const optional = scenario.optionalPaths || [];
  for (const relPath of optional) {
    const fullPath = path.join(rootDir, relPath);
    if (await fileExists(fullPath)) score += 1;
  }

  return { ok: true, score };
}

async function selectScenarios({ rootDir, config }) {
  const candidates = [];
  for (const scenario of SCENARIO_CATALOG) {
    const availability = await resolveScenarioAvailability(rootDir, scenario);
    if (!availability.ok) continue;
    candidates.push({ scenario, score: availability.score });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const selectedIds = new Set();
  const excluded = new Set(config.exclude || []);

  for (const id of normalizeStringArray(config.pin)) {
    const match = candidates.find((entry) => entry.scenario.id === id);
    if (!match) continue;
    if (selectedIds.has(match.scenario.id)) continue;
    selected.push(match.scenario);
    selectedIds.add(match.scenario.id);
  }

  for (const entry of candidates) {
    const id = entry.scenario.id;
    if (selectedIds.has(id)) continue;
    if (excluded.has(id)) continue;
    if (selected.length >= config.max_scenarios) break;
    selected.push(entry.scenario);
    selectedIds.add(id);
  }

  const filtered = selected.filter((scenario) => !excluded.has(scenario.id));
  if (filtered.length > config.max_scenarios) {
    return filtered.slice(0, config.max_scenarios);
  }
  return filtered;
}

function formatLifelineText(lifeline) {
  const lines = [`**${lifeline.name}**`];
  if (lifeline.subtitle) {
    lines.push(`\`${lifeline.subtitle}\``);
  }
  if (lifeline.notes) {
    lines.push("");
    lines.push(lifeline.notes);
  }
  return lines.join("\n");
}

function formatMessageText(message, index) {
  const params = message.params ? `(${message.params})` : "";
  const action = `${message.action}${params}`;
  return `${index}. ${action}\nAI: ${message.summary}`;
}

function buildCanvasModel({ scenarios, config }) {
  const nodes = [];
  const edges = [];
  let cursorY = 40;

  for (const scenario of scenarios) {
    const title = config.labels?.[scenario.id] || scenario.title || scenario.id;
    const lifelines = scenario.lifelines || [];
    const messages = scenario.messages || [];
    const lifelineCount = lifelines.length;
    const lifelineBandWidth =
      lifelineCount * LIFELINE_WIDTH +
      Math.max(0, lifelineCount - 1) * LIFELINE_GAP +
      GROUP_PADDING * 2;
    const minWidth = MESSAGE_WIDTH + GROUP_PADDING * 2;
    const groupWidth = Math.max(lifelineBandWidth, minWidth);
    const groupHeight = MESSAGE_START_Y + messages.length * MESSAGE_GAP + GROUP_PADDING;

    const groupNode = {
      id: `group_${scenario.id}`,
      type: "group",
      x: 40,
      y: cursorY,
      width: groupWidth,
      height: groupHeight,
      label: `[Scenario] ${title}`,
    };
    nodes.push(groupNode);

    const lifelinePositions = new Map();
    lifelines.forEach((lifeline, index) => {
      const x = groupNode.x + GROUP_PADDING + index * (LIFELINE_WIDTH + LIFELINE_GAP);
      const y = groupNode.y + GROUP_PADDING;
      const id = `lifeline_${scenario.id}_${lifeline.id}`;
      lifelinePositions.set(lifeline.id, { x, y, id });
      nodes.push({
        id,
        type: "text",
        x,
        y,
        width: LIFELINE_WIDTH,
        height: LIFELINE_HEIGHT,
        text: formatLifelineText(lifeline),
        color: lifeline.color || "2",
      });
    });

    messages.forEach((message, idx) => {
      const from = lifelinePositions.get(message.from);
      const to = lifelinePositions.get(message.to);
      if (!from || !to) return;

      const fromX = from.x + LIFELINE_WIDTH / 2;
      const toX = to.x + LIFELINE_WIDTH / 2;
      const labelXCenter = (fromX + toX) / 2;
      const labelXRaw = Math.round(labelXCenter - MESSAGE_WIDTH / 2);
      const minX = groupNode.x + GROUP_PADDING;
      const maxX = groupNode.x + groupWidth - GROUP_PADDING - MESSAGE_WIDTH;
      const labelX = Math.max(minX, Math.min(maxX, labelXRaw));
      const labelY = groupNode.y + MESSAGE_START_Y + idx * MESSAGE_GAP;
      const messageId = `message_${scenario.id}_${idx + 1}`;

      nodes.push({
        id: messageId,
        type: "text",
        x: labelX,
        y: labelY,
        width: MESSAGE_WIDTH,
        height: MESSAGE_HEIGHT,
        text: formatMessageText(message, idx + 1),
      });

      const fromSide = fromX <= toX ? "right" : "left";
      const toSide = fromX <= toX ? "left" : "right";
      edges.push({
        id: `edge_${scenario.id}_${idx + 1}`,
        fromNode: from.id,
        fromSide,
        toNode: to.id,
        toSide,
      });
    });

    cursorY += groupHeight + GROUP_GAP_Y;
  }

  return { nodes, edges };
}

async function writeCanvasFile(outputPath, canvas) {
  const payload = JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }, null, 2) + "\n";
  await fs.writeFile(outputPath, payload, "utf8");
}

function buildSummary({ outputPath, scenarios, canvas }) {
  const messageCount = scenarios.reduce(
    (sum, scenario) => sum + (scenario.messages || []).length,
    0,
  );
  const lifelineCount = scenarios.reduce(
    (sum, scenario) => sum + (scenario.lifelines || []).length,
    0,
  );
  const maxDepth = scenarios.reduce(
    (max, scenario) => Math.max(max, (scenario.messages || []).length),
    0,
  );

  return [
    `Generated interaction sequence canvas: ${outputPath}`,
    `  Scenarios: ${scenarios.length}`,
    `  Max depth: ${maxDepth}`,
    `  Lifelines: ${lifelineCount}`,
    `  Messages: ${messageCount}`,
    "",
  ].join("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const rootDir = path.resolve(opts.root || process.cwd());
  const projectName = path.basename(rootDir);
  const preferredOut = opts.out
    ? path.resolve(opts.out)
    : path.join(rootDir, "interaction_sequence.canvas");
  let outputPath = preferredOut;

  const { config } = await loadConfig({ rootDir, configPath: opts.config });
  const scenarios = await selectScenarios({ rootDir, config });
  const canvas = buildCanvasModel({ scenarios, config });

  try {
    await writeCanvasFile(outputPath, canvas);
  } catch (_err) {
    const fallback = path.join(os.homedir(), `interaction_sequence_${projectName}.canvas`);
    outputPath = fallback;
    await writeCanvasFile(outputPath, canvas);
  }

  process.stdout.write(buildSummary({ outputPath, scenarios, canvas }));
}

if (require.main === module) {
  main().catch((err) => {
    const msg = err && err.stack ? err.stack : String(err);
    process.stderr.write(msg + "\n");
    process.exitCode = 1;
  });
}

module.exports = {
  loadConfig,
  selectScenarios,
  buildCanvasModel,
};
