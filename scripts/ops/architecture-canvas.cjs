"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const SOURCE_EXTENSIONS = new Set([
  ".py",
  ".js",
  ".ts",
  ".java",
  ".go",
  ".rb",
  ".php",
  ".cs",
  ".jsx",
  ".tsx",
  ".vue",
]);

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "__pycache__",
  ".venv",
  "dist",
  "build",
  ".git",
  ".worktrees",
  "worktrees",
  ".tmp",
  "insforge-functions",
]);

const CONFIG_FILES = [
  "package.json",
  "requirements.txt",
  "go.mod",
  "pom.xml",
  "Gemfile",
  "composer.json",
];

const FRONT_DIR_HINTS = ["frontend", "client", "web", "dashboard", "ui"];
const BACK_DIR_HINTS = ["backend", "server", "api", "services", "insforge", "src"];

const ENABLE_AGGREGATION = false;
const ENABLE_ISOLATED_GROUPING = false;
const ENABLE_MODULE_GROUPS = true;

const PROTECTED_CATEGORIES = new Set([
  "entry",
  "routing",
  "controller",
  "service",
  "data",
  "infra",
  "frontend",
  "state",
  "utils",
  "config",
  "test",
  "edge-function",
]);

const CATEGORY_DEFINITIONS = [
  {
    name: "test",
    description: "Test module.",
    group: "test",
    color: "2",
    match: (p) =>
      p.includes("/tests/") ||
      p.includes("/test/") ||
      p.includes(".test.") ||
      p.includes(".spec.") ||
      p.endsWith("_test.py") ||
      p.endsWith("_test.go"),
  },
  {
    name: "config",
    description: "Configuration module.",
    group: "infra",
    color: "2",
    match: (p) => p.includes("/config/") || p.includes(".config.") || p.includes("settings") || p.endsWith(".env"),
  },
  {
    name: "entry",
    description: "Entry module.",
    group: "entry",
    color: "1",
    match: (p) => {
      const base = path.posix.basename(p);
      return (
        base.startsWith("main.") ||
        base.startsWith("app.") ||
        base.startsWith("index.") ||
        base.startsWith("server.") ||
        base === "__main__.py"
      );
    },
  },
  {
    name: "frontend",
    description: "UI component layer.",
    group: "frontend",
    color: "6",
    match: (p) => p.includes("/components/") || p.endsWith(".vue") || p.endsWith(".jsx") || p.endsWith(".tsx") || p.includes(".component."),
  },
  {
    name: "state",
    description: "State management layer.",
    group: "frontend",
    color: "6",
    match: (p) => p.includes("/store/") || p.includes("/redux/") || p.includes("/state/"),
  },
  {
    name: "routing",
    description: "Routing layer.",
    group: "routing",
    color: "3",
    match: (p, c) => p.includes("/routes/") || p.includes("/api/") || /@app\.route|express\.Router/i.test(c || ""),
  },
  {
    name: "edge-function",
    description: "Edge function handler.",
    group: "controller",
    color: "3",
    match: (p) => p.startsWith("insforge-src/functions/") || p.includes("/insforge-src/functions/"),
  },
  {
    name: "controller",
    description: "Request handling layer.",
    group: "controller",
    color: "3",
    match: (p) => p.includes("/functions/") && (p.includes("/server/") || p.includes("/api/") || p.includes("/insforge-")),
  },
  {
    name: "controller",
    description: "Request handling layer.",
    group: "controller",
    color: "3",
    match: (p, c) => p.includes("/controllers/") || p.includes("/handlers/") || /class\s+\w*Controller\b/i.test(c || ""),
  },
  {
    name: "middleware",
    description: "Middleware layer.",
    group: "controller",
    color: "3",
    match: (p, c) => p.includes("/middleware/") || p.includes("/interceptors/") || /@middleware\b/i.test(c || ""),
  },
  {
    name: "service",
    description: "Business logic layer.",
    group: "service",
    color: "3",
    match: (p, c) => p.includes("/services/") || p.includes("/business/") || /class\s+\w*Service\b/i.test(c || ""),
  },
  {
    name: "model",
    description: "Data model layer.",
    group: "data",
    color: "5",
    match: (p, c) => p.includes("/models/") || p.includes("/entities/") || p.includes("/schemas/") || /class\s+\w*Model\b/i.test(c || ""),
  },
  {
    name: "data-access",
    description: "Data access layer.",
    group: "data",
    color: "5",
    match: (p, c) => p.includes("/dao/") || p.includes("/repositories/") || /\.query\(|\.execute\(/i.test(c || ""),
  },
  {
    name: "integration",
    description: "External integration layer.",
    group: "infra",
    color: "4",
    match: (p) => p.includes("/integrations/") || p.includes("/clients/") || p.includes("/adapters/"),
  },
  {
    name: "utils",
    description: "Shared utilities.",
    group: "utils",
    color: "2",
    match: (p) =>
      p.includes("/utils/") ||
      p.includes("/helpers/") ||
      p.includes("/lib/") ||
      p.includes("/common/") ||
      p.includes("/shared/"),
  },
  {
    name: "utils",
    description: "Operational scripts and tools.",
    group: "utils",
    color: "2",
    match: (p) => p.includes("/scripts/") || p.includes("/ops/"),
  },
];

const DEFAULT_CATEGORY = {
  name: "misc",
  description: "General module.",
  group: "misc",
  color: "2",
};

const EXTERNAL_SERVICE_PATTERNS = [
  { name: "OpenAI", regex: /\bopenai\b|@openai\//i },
  { name: "Anthropic", regex: /\banthropic\b|\bclaude\b/i },
  { name: "Stripe", regex: /\bstripe\b/i },
  { name: "Twilio", regex: /\btwilio\b/i },
  { name: "SendGrid", regex: /\bsendgrid\b/i },
  { name: "Slack", regex: /\bslack_sdk\b|\bslack\b/i },
  { name: "AWS", regex: /\baws-sdk\b|\b@aws-sdk\b|\bboto3\b/i },
  { name: "Google Cloud", regex: /\bgoogle-cloud\b/i },
  { name: "Azure", regex: /\bazure-sdk\b/i },
  { name: "Kafka", regex: /\bkafka\b/i },
  { name: "RabbitMQ", regex: /\brabbitmq\b|\bamqp\b/i },
  { name: "Redis", regex: /\bredis\b/i },
  { name: "InsForge", regex: /\binsforge\b/i },
];

const SOFT_NODE_LIMIT = 300;

function printHelp() {
  process.stdout.write(
    [
      "Obsidian Canvas architecture generator",
      "",
      "Usage:",
      "  node scripts/ops/architecture-canvas.cjs [--root <path>] [--out <path>]",
      "",
      "Options:",
      "  --root <path>   Project root (default: cwd)",
      "  --out <path>    Output path (default: <root>/architecture.canvas)",
      "  --help          Show help",
      "",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const opts = { root: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--root") {
      opts.root = argv[++i] || null;
      continue;
    }
    if (arg === "--out") {
      opts.out = argv[++i] || null;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(relPath) {
  return relPath.split(path.sep).join("/");
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(16);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickOffset(id, maxAbs) {
  const hash = parseInt(hashString(id).slice(0, 8), 16) || 0;
  const normalized = (hash % 1000) / 1000;
  const offset = (normalized * 2 - 1) * maxAbs;
  return Math.round(offset);
}

async function scanSourceFiles(rootDir, warnings) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      warnings.push(`Unreadable directory: ${current} (${err.message})`);
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

async function readFileSafe(filePath, warnings) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    warnings.push(`Unreadable file: ${filePath} (${err.message})`);
    return null;
  }
}

function classifyFile(relPath, content) {
  const posixPath = toPosixPath(relPath).toLowerCase();
  const body = content || "";
  for (const def of CATEGORY_DEFINITIONS) {
    if (def.match(posixPath, body)) {
      return {
        category: def.name,
        description: def.description,
        group: def.group,
        color: def.color,
      };
    }
  }
  return { ...DEFAULT_CATEGORY };
}

function extractSymbols(relPath, content) {
  const ext = path.extname(relPath).toLowerCase();
  const classes = [];
  const functions = [];
  if (!content) return { classes, functions };

  const classRegex = /\bclass\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = classRegex.exec(content))) {
    classes.push(match[1]);
    if (classes.length >= 3) break;
  }

  const funcRegexes = [];
  if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
    funcRegexes.push(/\bfunction\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g);
    funcRegexes.push(/\bconst\s+([A-Za-z0-9_]+)\s*=\s*\(([^)]*)\)\s*=>/g);
    funcRegexes.push(/\blet\s+([A-Za-z0-9_]+)\s*=\s*\(([^)]*)\)\s*=>/g);
    funcRegexes.push(/\bvar\s+([A-Za-z0-9_]+)\s*=\s*\(([^)]*)\)\s*=>/g);
  } else if (ext === ".py") {
    funcRegexes.push(/^\s*def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm);
  } else if ([".java", ".cs"].includes(ext)) {
    funcRegexes.push(/\b([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/g);
  } else if (ext === ".go") {
    funcRegexes.push(/\bfunc\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g);
  }

  for (const re of funcRegexes) {
    while ((match = re.exec(content))) {
      if (ext === ".java" || ext === ".cs") {
        functions.push({ name: match[2], params: match[3] });
      } else {
        functions.push({ name: match[1], params: match[2] });
      }
      if (functions.length >= 3) break;
    }
    if (functions.length >= 3) break;
  }

  return { classes, functions };
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r\n|\r|\n/).length;
}

function detectExternalServices(content) {
  const hits = new Set();
  if (!content) return hits;
  for (const { name, regex } of EXTERNAL_SERVICE_PATTERNS) {
    if (regex.test(content)) hits.add(name);
  }
  return hits;
}

function resolveRelativeImport(importPath, fromDir, fileIndex) {
  const raw = importPath.split("?")[0].split("#")[0];
  const basePath = path.resolve(fromDir, raw);
  if (fileIndex.has(basePath)) return basePath;

  const ext = path.extname(basePath);
  if (ext) {
    if (fileIndex.has(basePath)) return basePath;
  } else {
    const candidates = [
      `${basePath}.js`,
      `${basePath}.ts`,
      `${basePath}.jsx`,
      `${basePath}.tsx`,
      `${basePath}.json`,
      `${basePath}.py`,
      `${basePath}.go`,
      `${basePath}.java`,
      `${basePath}.cs`,
      `${basePath}.rb`,
      `${basePath}.php`,
    ];
    for (const candidate of candidates) {
      if (fileIndex.has(candidate)) return candidate;
    }
  }

  const indexCandidates = [
    path.join(basePath, "index.js"),
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.jsx"),
    path.join(basePath, "index.tsx"),
  ];
  for (const candidate of indexCandidates) {
    if (fileIndex.has(candidate)) return candidate;
  }

  return null;
}

function resolvePythonImport(importPath, fromDir, fileIndex) {
  if (!importPath.startsWith(".")) return null;
  let level = 0;
  while (importPath[level] === ".") level++;
  const modulePath = importPath.slice(level).replace(/\./g, path.sep);
  let baseDir = fromDir;
  for (let i = 1; i < level; i++) {
    baseDir = path.dirname(baseDir);
  }
  const targetBase = modulePath ? path.join(baseDir, modulePath) : baseDir;
  const candidates = [
    `${targetBase}.py`,
    path.join(targetBase, "__init__.py"),
  ];
  for (const candidate of candidates) {
    if (fileIndex.has(candidate)) return candidate;
  }
  return null;
}

function extractLocalImports(relPath, content, fileIndex) {
  const imports = new Set();
  if (!content) return imports;
  const ext = path.extname(relPath).toLowerCase();
  const fromDir = path.dirname(path.resolve(relPath));

  if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
    const patterns = [
      /\bimport\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
      /\bimport\s+['"]([^'"]+)['"]/g,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content))) {
        const target = match[1];
        if (!target.startsWith(".")) continue;
        const resolved = resolveRelativeImport(target, fromDir, fileIndex);
        if (resolved) imports.add(resolved);
      }
    }
  } else if (ext === ".py") {
    const fromPattern = /^\s*from\s+([\.\w]+)\s+import\s+/gm;
    const importPattern = /^\s*import\s+([\.\w]+)\b/gm;
    let match;
    while ((match = fromPattern.exec(content))) {
      const resolved = resolvePythonImport(match[1], fromDir, fileIndex);
      if (resolved) imports.add(resolved);
    }
    while ((match = importPattern.exec(content))) {
      const resolved = resolvePythonImport(match[1], fromDir, fileIndex);
      if (resolved) imports.add(resolved);
    }
  }

  return imports;
}

function detectArchitecture({ rootDir, topDirs, configHits, fileInfos }) {
  const hasFront = topDirs.some((dir) => FRONT_DIR_HINTS.includes(dir));
  const hasBack = topDirs.some((dir) => BACK_DIR_HINTS.includes(dir));
  if (hasFront && hasBack) return "前后端分离";

  const serviceDirs = topDirs.filter((dir) => dir.endsWith("-service") || dir.includes("service"));
  if (serviceDirs.length >= 2) return "微服务架构";

  const hasPipeline = topDirs.some((dir) => ["pipelines", "jobs", "tasks"].includes(dir));
  if (hasPipeline) return "数据管道";

  const hasWebLayer = fileInfos.some((info) => ["routing", "controller"].includes(info.category));
  const hasFrontend = fileInfos.some((info) => info.category === "frontend");

  if (!hasWebLayer && !hasFrontend && configHits.length > 0) {
    return "库/工具项目";
  }

  return "单体应用";
}

function isFrontSide(relPath) {
  const parts = toPosixPath(relPath).toLowerCase().split("/");
  return parts.some((part) => FRONT_DIR_HINTS.includes(part)) || /\.jsx$|\.tsx$|\.vue$/i.test(relPath);
}

function isBackSide(relPath) {
  const parts = toPosixPath(relPath).toLowerCase().split("/");
  return parts.some((part) => BACK_DIR_HINTS.includes(part));
}

function buildNodeText(info, dependencyCounts) {
  const relPath = toPosixPath(info.relPath);
  const displayName = info.displayName;
  const lines = info.lineCount;
  const classes = info.symbols.classes;
  const functions = info.symbols.functions;

  const contentLines = [];
  contentLines.push(`**${displayName}**`);
  contentLines.push(`\`${relPath}\``);
  contentLines.push("");
  contentLines.push(info.description);
  contentLines.push("");
  contentLines.push("包含：");

  if (classes.length > 0) {
    contentLines.push(`- ${classes[0]} (${lines} 行)`);
  } else {
    contentLines.push(`- ${displayName} (${lines} 行)`);
  }

  if (functions.length > 0) {
    const fn = functions[0];
    const paramCount = countParams(fn.params);
    contentLines.push(`- ${fn.name} (${paramCount} 个参数)`);
  } else {
    contentLines.push("- exports (0 个参数)");
  }

  const deps = dependencyCounts?.outgoing || 0;
  const inbound = dependencyCounts?.incoming || 0;
  contentLines.push("");
  contentLines.push(`依赖：${deps} 个模块`);
  contentLines.push(`被依赖：${inbound} 次`);

  return contentLines.join("\n");
}

function countParams(paramsText) {
  if (!paramsText) return 0;
  const trimmed = paramsText.trim();
  if (!trimmed) return 0;
  return trimmed.split(",").map((p) => p.trim()).filter(Boolean).length;
}

function buildAggregatedText(group) {
  const contentLines = [];
  contentLines.push(`**${group.displayName}**`);
  contentLines.push(`\`${group.samplePath}\``);
  contentLines.push("");
  contentLines.push(group.description);
  contentLines.push("");
  contentLines.push("包含：");
  contentLines.push(`- ${group.fileCount} files (grouped)`);
  contentLines.push(`- samples: ${group.sampleNames.join(", ")}`);
  contentLines.push("");
  contentLines.push(`依赖：${group.outgoing} 个模块`);
  contentLines.push(`被依赖：${group.incoming} 次`);
  return contentLines.join("\n");
}

function calculateNodeHeight(text) {
  const lines = text.split("\n").length;
  return Math.max(120, lines * 20 + 12);
}

function groupByCategory(fileInfos) {
  const counts = new Map();
  for (const info of fileInfos) {
    counts.set(info.category, (counts.get(info.category) || 0) + 1);
  }
  return counts;
}

function mergeSmallCategories(fileInfos, minCount, options = {}) {
  const keepCategories = options.keepCategories || new Set();
  const counts = groupByCategory(fileInfos);
  for (const info of fileInfos) {
    const count = counts.get(info.category) || 0;
    if (info.category !== "external" && count > 0 && count < minCount && !keepCategories.has(info.category)) {
      info.category = "misc";
      info.group = "misc";
      info.color = DEFAULT_CATEGORY.color;
      info.description = DEFAULT_CATEGORY.description;
    }
  }
}

function buildFileNodes(fileInfos) {
  const nodes = [];
  const nodeByPath = new Map();
  for (const info of fileInfos) {
    const base = info.displayName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const id = `${info.category}_${base}_${hashString(info.relPath)}`;
    const node = {
      id,
      type: "text",
      text: "",
      x: 0,
      y: 0,
      width: 280,
      height: 120,
      color: info.color,
      meta: {
        relPath: info.relPath,
        category: info.category,
        group: info.group,
        side: info.side,
      },
    };
    nodes.push(node);
    nodeByPath.set(info.absPath, node);
  }
  return { nodes, nodeByPath };
}

function buildExternalNodes(externalServices) {
  const nodes = [];
  const nodeByService = new Map();
  for (const service of externalServices) {
    const id = `external_${service.replace(/[^a-zA-Z0-9_-]/g, "_")}_${hashString(service)}`;
    const node = {
      id,
      type: "text",
      text: "",
      x: 0,
      y: 0,
      width: 280,
      height: 160,
      color: "4",
      meta: {
        relPath: "external",
        category: "external",
        group: "external",
        side: "right",
      },
      externalService: service,
    };
    nodes.push(node);
    nodeByService.set(service, node);
  }
  return { nodes, nodeByService };
}

function buildEdges(fileInfos, nodeByPath, externalNodes, fileIndex) {
  const edgeWeights = new Map();
  const edgeMeta = new Map();

  for (const info of fileInfos) {
    const fromNode = nodeByPath.get(info.absPath);
    if (!fromNode) continue;

    for (const targetPath of info.imports) {
      const toNode = nodeByPath.get(targetPath);
      if (!toNode || toNode.id === fromNode.id) continue;
      const key = `${fromNode.id}::${toNode.id}`;
      edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
    }

    for (const service of info.externalServices) {
      const toNode = externalNodes.get(service);
      if (!toNode) continue;
      const key = `${fromNode.id}::${toNode.id}`;
      edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
      edgeMeta.set(key, { isExternal: true });
    }
  }

  const edges = [];
  for (const [key, weight] of edgeWeights.entries()) {
    const [from, to] = key.split("::");
    const meta = edgeMeta.get(key);
    edges.push({ from, to, weight, isExternal: meta?.isExternal === true });
  }

  return edges;
}

function assignDependencyCounts(nodes, edges) {
  const counts = new Map();
  for (const node of nodes) {
    counts.set(node.id, { outgoing: 0, incoming: 0 });
  }
  for (const edge of edges) {
    const from = counts.get(edge.from);
    const to = counts.get(edge.to);
    if (from) from.outgoing += 1;
    if (to) to.incoming += 1;
  }
  return counts;
}

function buildExternalText(service, counts) {
  const outgoing = counts?.outgoing || 0;
  const incoming = counts?.incoming || 0;
  return [
    `**${service}**`,
    "`external`",
    "",
    "Third-party service.",
    "",
    "包含：",
    `- ${service} (integration)`,
    "- api (0 个参数)",
    "",
    `依赖：${outgoing} 个模块`,
    `被依赖：${incoming} 次`,
  ].join("\n");
}

function determineLayerOrder(nodes) {
  const order = [
    "entry",
    "frontend",
    "routing",
    "controller",
    "service",
    "data",
    "infra",
    "external",
    "utils",
    "test",
    "misc",
  ];
  const present = new Set(nodes.map((n) => n.meta.group));
  return order.filter((g) => present.has(g));
}

function layoutNodes(nodes, edges, architecture, options = {}) {
  if (nodes.length === 0) return;

  const getModuleKey = options.getModuleKey || ((node) => {
    const rel = node.meta?.relPath || "";
    const top = toPosixPath(rel).split("/")[0] || "root";
    return top || "root";
  });

  const groups = new Map();
  for (const node of nodes) {
    const key = node.meta.group || "misc";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }

  let layerOrder = determineLayerOrder(nodes);
  if (layerOrder.length < 3) {
    if (!layerOrder.includes("misc")) layerOrder.push("misc");
    if (layerOrder.length < 3 && !layerOrder.includes("utils")) layerOrder.push("utils");
  }
  if (layerOrder.length > 11) {
    layerOrder = layerOrder.slice(0, 10).concat("misc");
  }

  const minSpacingX = options.minSpacingX ?? 380;
  const minSpacingY = options.minSpacingY ?? 260;
  const modulePadding = options.modulePadding ?? 40;
  const moduleGap = options.moduleGap ?? 240;
  const rowGap = options.rowGap ?? 180;
  const layerGap = options.layerGap ?? 220;
  const fullWidth = options.fullWidth ?? 2000;
  const sideWidth = options.sideWidth ?? 900;
  const leftStartX = options.leftStartX ?? 100;
  const rightStartX = options.rightStartX ?? 1200;

  const groupModules = (subset) => {
    const map = new Map();
    for (const node of subset) {
      const key = getModuleKey(node);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    }
    const modules = [];
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.meta?.relPath || a.id).localeCompare(b.meta?.relPath || b.id));
      modules.push({ key, nodes: list });
    }
    modules.sort((a, b) => a.key.localeCompare(b.key));
    return modules;
  };

  const computeModuleGrid = (nodesInModule, maxWidth) => {
    const usableWidth = Math.max(minSpacingX, maxWidth - modulePadding * 2);
    const maxColumns = Math.max(1, Math.floor(usableWidth / minSpacingX));
    const idealColumns = Math.ceil(Math.sqrt(nodesInModule.length));
    const columns = clamp(idealColumns, 1, maxColumns);
    const rows = Math.ceil(nodesInModule.length / columns);
    const width = columns * minSpacingX + modulePadding * 2;
    const height = rows * minSpacingY + modulePadding * 2;
    return { columns, rows, width, height };
  };

  const placeModules = (subset, startX, maxWidth, baseY) => {
    if (subset.length === 0) return 0;
    const modules = groupModules(subset);

    let cursorX = startX;
    let cursorY = baseY;
    let rowHeight = 0;
    let totalHeight = 0;

    for (const mod of modules) {
      const grid = computeModuleGrid(mod.nodes, maxWidth);
      if (cursorX !== startX && cursorX + grid.width > startX + maxWidth) {
        cursorX = startX;
        cursorY += rowHeight + rowGap;
        totalHeight += rowHeight + rowGap;
        rowHeight = 0;
      }

      for (let i = 0; i < mod.nodes.length; i++) {
        const node = mod.nodes[i];
        const col = i % grid.columns;
        const row = Math.floor(i / grid.columns);
        const offsetX = pickOffset(node.id + ":x", 12);
        const offsetY = pickOffset(node.id + ":y", 8);
        node.x = Math.round(cursorX + modulePadding + col * minSpacingX + offsetX);
        node.y = Math.round(cursorY + modulePadding + row * minSpacingY + offsetY);
      }

      rowHeight = Math.max(rowHeight, grid.height);
      cursorX += grid.width + moduleGap;
    }

    totalHeight += rowHeight;
    return totalHeight;
  };

  let currentY = options.startY ?? 100;
  for (let layerIndex = 0; layerIndex < layerOrder.length; layerIndex++) {
    const layerKey = layerOrder[layerIndex];
    const layerNodes = groups.get(layerKey) || [];
    if (layerNodes.length === 0) continue;
    const sameSide = architecture === "前后端分离";

    const leftNodes = [];
    const rightNodes = [];
    if (sameSide) {
      for (const node of layerNodes) {
        if (node.meta.side === "left") leftNodes.push(node);
        else rightNodes.push(node);
      }
    }

    if (sameSide) {
      const leftHeight = placeModules(leftNodes, leftStartX, sideWidth, currentY);
      const rightHeight = placeModules(rightNodes, rightStartX, sideWidth, currentY);
      const layerHeight = Math.max(leftHeight, rightHeight, minSpacingY);
      currentY += layerHeight + layerGap;
    } else {
      const height = placeModules(layerNodes, leftStartX, fullWidth, currentY);
      currentY += Math.max(height, minSpacingY) + layerGap;
    }
  }
}

function edgeDirection(fromNode, toNode) {
  if (!fromNode || !toNode) {
    return { fromSide: "right", toSide: "left" };
  }
  const fromLayer = fromNode.meta.layerIndex ?? 0;
  const toLayer = toNode.meta.layerIndex ?? 0;
  if (fromLayer < toLayer) {
    return { fromSide: "bottom", toSide: "top" };
  }
  if (fromLayer > toLayer) {
    return { fromSide: "top", toSide: "bottom" };
  }
  return { fromSide: "right", toSide: "left" };
}

function annotateLayers(nodes) {
  const order = determineLayerOrder(nodes);
  const indexByGroup = new Map(order.map((g, i) => [g, i]));
  for (const node of nodes) {
    if (!node.meta) continue;
    node.meta.layerIndex = indexByGroup.get(node.meta.group) ?? 0;
  }
}

function pruneEdges(rawEdges, options = {}) {
  const maxEdges = options.maxEdges ?? 50;
  const maxOut = options.maxOut ?? 5;
  const keepExternal = options.keepExternal ?? false;
  const maxGroupEdges = options.maxGroupEdges ?? Math.max(10, Math.floor(maxEdges * 0.4));
  const nodes = options.nodes || [];
  const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
  const edges = [...rawEdges].sort((a, b) => b.weight - a.weight || a.from.localeCompare(b.from));
  const result = [];
  const outCount = new Map();
  const groupCounts = new Map();
  const seen = new Set();

  const edgeKey = (edge) => `${edge.from}::${edge.to}`;
  const canAdd = (edge, ignoreMaxOut = false, ignoreGroupCap = false) => {
    if (seen.has(edgeKey(edge))) return false;
    if (!ignoreMaxOut) {
      const count = outCount.get(edge.from) || 0;
      if (count >= maxOut) return false;
    }
    if (!ignoreGroupCap && nodeIndex.size > 0) {
      const group = nodeIndex.get(edge.from)?.meta?.group;
      if (group) {
        const count = groupCounts.get(group) || 0;
        if (count >= maxGroupEdges) return false;
      }
    }
    return true;
  };
  const addEdge = (edge, ignoreMaxOut = false, ignoreGroupCap = false) => {
    if (!canAdd(edge, ignoreMaxOut, ignoreGroupCap)) return false;
    seen.add(edgeKey(edge));
    outCount.set(edge.from, (outCount.get(edge.from) || 0) + 1);
    if (nodeIndex.size > 0) {
      const group = nodeIndex.get(edge.from)?.meta?.group;
      if (group) groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    }
    result.push(edge);
    return true;
  };

  if (keepExternal) {
    const externalEdges = edges.filter((edge) => edge.isExternal);
    if (externalEdges.length > 0 && nodeIndex.size > 0) {
      const edgesByService = new Map();
      for (const edge of externalEdges) {
        const service = nodeIndex.get(edge.to)?.externalService || edge.to;
        if (!edgesByService.has(service)) edgesByService.set(service, []);
        edgesByService.get(service).push(edge);
      }
      let externalCount = 0;
      const maxExternalEdges = Math.max(
        options.maxExternalEdges ?? Math.min(maxEdges, 12),
        edgesByService.size
      );
      for (const groupEdges of edgesByService.values()) {
        for (const edge of groupEdges) {
          if (addEdge(edge, true)) {
            externalCount += 1;
            break;
          }
        }
      }
      for (const edge of externalEdges) {
        if (externalCount >= maxExternalEdges) break;
        if (addEdge(edge, true)) externalCount += 1;
      }
    } else {
      for (const edge of externalEdges) {
        addEdge(edge, true);
      }
    }
  }

  if (nodeIndex.size > 0) {
    const edgesByGroup = new Map();
    for (const edge of edges) {
      const fromNode = nodeIndex.get(edge.from);
      const group = fromNode?.meta?.group;
      if (!group) continue;
      if (!edgesByGroup.has(group)) edgesByGroup.set(group, []);
      edgesByGroup.get(group).push(edge);
    }
    for (const groupEdges of edgesByGroup.values()) {
      if (result.length >= maxEdges) break;
      for (const edge of groupEdges) {
        if (addEdge(edge)) break;
      }
    }
  }

  for (const edge of edges) {
    if (result.length >= maxEdges) break;
    addEdge(edge);
  }

  return result;
}

function applyIsolatedGrouping(nodes, edges) {
  const counts = assignDependencyCounts(nodes, edges);
  const isolated = nodes.filter((n) => {
    const c = counts.get(n.id);
    return !c || (c.outgoing === 0 && c.incoming === 0);
  });

  if (nodes.length === 0) return { nodes, edges };
  if (isolated.length / nodes.length <= 0.1) return { nodes, edges };

  const willExceed = edges.length + isolated.length > 50;
  if (willExceed) {
    const groupedId = `utilities_${hashString("isolated")}`;
    const groupedNode = {
      id: groupedId,
      type: "text",
      text: `**工具模块**\n\`grouped\`\n\nGrouped isolated modules.\n\n包含：\n- ${isolated.length} files (grouped)\n- samples: ${isolated.slice(0, 3).map((n) => n.meta.relPath).join(", ") || "n/a"}\n\n依赖：0 个模块\n被依赖：0 次`,
      x: 0,
      y: 0,
      width: 280,
      height: 160,
      color: "2",
      meta: {
        relPath: "grouped",
        category: "misc",
        group: "utils",
        side: "right",
      },
    };
    const isolatedIds = new Set(isolated.map((n) => n.id));
    const remainingNodes = nodes.filter((n) => !isolatedIds.has(n.id));
    const remainingEdges = edges.filter((edge) => !isolatedIds.has(edge.from) && !isolatedIds.has(edge.to));
    remainingNodes.push(groupedNode);
    return { nodes: remainingNodes, edges: remainingEdges };
  }

  const groupedNode = {
    id: `utilities_${hashString("isolated")}`,
    type: "text",
    text: `**工具模块**\n\`grouped\`\n\nGrouped isolated modules.\n\n包含：\n- ${isolated.length} files (grouped)\n- samples: ${isolated.slice(0, 3).map((n) => n.meta.relPath).join(", ") || "n/a"}\n\n依赖：0 个模块\n被依赖：0 次`,
    x: 0,
    y: 0,
    width: 280,
    height: 160,
    color: "2",
    meta: {
      relPath: "grouped",
      category: "misc",
      group: "utils",
      side: "right",
    },
  };

  nodes.push(groupedNode);
  for (const node of isolated) {
    edges.push({ from: groupedNode.id, to: node.id, weight: 1 });
  }
  return { nodes, edges };
}

function getModuleKeyFromRelPath(relPath) {
  if (!relPath) return "root";
  const normalized = toPosixPath(relPath);
  if (!normalized) return "root";
  if (normalized === "external") return "external";
  if (!normalized.includes("/")) return "root";
  const parts = normalized.split("/").filter(Boolean);
  return parts[0] || "root";
}

function computeBounds(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (typeof node.x !== "number" || typeof node.y !== "number") continue;
    const width = typeof node.width === "number" ? node.width : 0;
    const height = typeof node.height === "number" ? node.height : 0;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + width);
    maxY = Math.max(maxY, node.y + height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function shiftNodes(nodes, dx, dy) {
  for (const node of nodes) {
    if (typeof node.x === "number") node.x += dx;
    if (typeof node.y === "number") node.y += dy;
  }
}

function buildModuleGroups(nodes, options = {}) {
  const modulePadding = options.modulePadding ?? 80;
  const moduleGap = options.moduleGap ?? 220;
  const startX = options.startX ?? 100;
  let cursorY = options.startY ?? 100;

  const modules = new Map();
  for (const node of nodes) {
    if (!node.meta) continue;
    const moduleKey = getModuleKeyFromRelPath(node.meta.relPath);
    if (!modules.has(moduleKey)) modules.set(moduleKey, []);
    modules.get(moduleKey).push(node);
  }

  const moduleKeys = Array.from(modules.keys()).sort((a, b) => a.localeCompare(b));
  const groupNodes = [];

  for (const moduleKey of moduleKeys) {
    const moduleNodes = modules.get(moduleKey);
    if (!moduleNodes || moduleNodes.length === 0) continue;
    const bounds = computeBounds(moduleNodes);
    const dx = startX - bounds.minX + modulePadding;
    const dy = cursorY - bounds.minY + modulePadding;
    shiftNodes(moduleNodes, dx, dy);
    const padded = {
      minX: bounds.minX + dx - modulePadding,
      minY: bounds.minY + dy - modulePadding,
      width: bounds.width + modulePadding * 2,
      height: bounds.height + modulePadding * 2
    };

    groupNodes.push({
      id: `group_${hashString(`module:${moduleKey}`)}`,
      type: "group",
      x: Math.round(padded.minX),
      y: Math.round(padded.minY),
      width: Math.max(240, Math.round(padded.width)),
      height: Math.max(240, Math.round(padded.height)),
      label: moduleKey
    });

    cursorY = padded.minY + padded.height + moduleGap;
  }

  return { groupNodes, nodes };
}

function layoutModulesAsGrid(nodes, options = {}) {
  const modulePadding = options.modulePadding ?? 80;
  const moduleGap = options.moduleGap ?? 220;
  const startX = options.startX ?? 100;
  let cursorY = options.startY ?? 100;

  const modules = new Map();
  for (const node of nodes) {
    if (!node.meta) continue;
    const moduleKey = getModuleKeyFromRelPath(node.meta.relPath);
    if (!modules.has(moduleKey)) modules.set(moduleKey, []);
    modules.get(moduleKey).push(node);
  }

  const moduleKeys = Array.from(modules.keys()).sort((a, b) => a.localeCompare(b));
  const groupNodes = [];

  for (const moduleKey of moduleKeys) {
    const moduleNodes = modules.get(moduleKey);
    if (!moduleNodes || moduleNodes.length === 0) continue;

    moduleNodes.sort((a, b) => {
      const ar = a.meta?.relPath || a.id;
      const br = b.meta?.relPath || b.id;
      return ar.localeCompare(br);
    });

    const maxWidth = Math.max(...moduleNodes.map((n) => n.width || 0), 280);
    const maxHeight = Math.max(...moduleNodes.map((n) => n.height || 0), 160);
    const cellSize = Math.max(maxWidth + 80, maxHeight + 80);
    const count = moduleNodes.length;
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);

    for (let i = 0; i < moduleNodes.length; i++) {
      const node = moduleNodes[i];
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = startX + col * cellSize;
      const y = cursorY + row * cellSize;
      node.x = Math.round(x);
      node.y = Math.round(y);
    }

    const bounds = computeBounds(moduleNodes);
    groupNodes.push({
      id: `group_${hashString(`module:${moduleKey}`)}`,
      type: "group",
      x: Math.round(bounds.minX - modulePadding),
      y: Math.round(bounds.minY - modulePadding),
      width: Math.max(240, Math.round(bounds.width + modulePadding * 2)),
      height: Math.max(240, Math.round(bounds.height + modulePadding * 2)),
      label: moduleKey
    });

    cursorY = bounds.maxY + modulePadding + moduleGap;
  }

  return { groupNodes, nodes };
}

function aggregateNodesIfNeeded(nodes, edges, maxNodes = 300) {
  if (nodes.length <= maxNodes) return { nodes, edges };

  const groups = new Map();
  for (const node of nodes) {
    const relPath = node.meta.relPath || "";
    const topDir = toPosixPath(relPath).split("/")[0] || "root";
    const key = `${node.meta.group || "misc"}::${topDir}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        group: node.meta.group || "misc",
        category: node.meta.category || "misc",
        color: node.color,
        nodes: [],
      });
    }
    groups.get(key).nodes.push(node);
  }

  const aggregatedNodes = [];
  const nodeMap = new Map();
  for (const group of groups.values()) {
    const sample = group.nodes[0];
    const samplePath = sample.meta.relPath || "group";
    const sampleNames = group.nodes.slice(0, 3).map((n) => path.posix.basename(toPosixPath(n.meta.relPath)));
    const id = `group_${hashString(group.key)}`;
    const groupNode = {
      id,
      type: "text",
      text: "",
      x: 0,
      y: 0,
      width: 280,
      height: 160,
      color: group.color || "2",
      meta: {
        relPath: samplePath,
        category: group.category,
        group: group.group,
        side: "right",
      },
      groupInfo: {
        fileCount: group.nodes.length,
        sampleNames,
        description: "Grouped modules.",
        displayName: `${group.group} (${group.nodes.length})`,
        samplePath,
      },
    };
    aggregatedNodes.push(groupNode);
    for (const node of group.nodes) {
      nodeMap.set(node.id, groupNode.id);
    }
  }

  const edgeWeights = new Map();
  for (const edge of edges) {
    const from = nodeMap.get(edge.from) || edge.from;
    const to = nodeMap.get(edge.to) || edge.to;
    if (from === to) continue;
    const key = `${from}::${to}`;
    const record = edgeWeights.get(key) || { weight: 0, isExternal: false };
    record.weight += edge.weight;
    if (edge.isExternal) record.isExternal = true;
    edgeWeights.set(key, record);
  }

  const aggregatedEdges = [];
  for (const [key, record] of edgeWeights.entries()) {
    const [from, to] = key.split("::");
    aggregatedEdges.push({ from, to, weight: record.weight, isExternal: record.isExternal });
  }

  return { nodes: aggregatedNodes, edges: aggregatedEdges };
}

function ensureMinimumNodes(nodes) {
  if (nodes.length >= 8) return nodes;
  const existing = new Set(nodes.map((n) => n.id));
  const rootNode = {
    id: `root_${hashString("root")}`,
    type: "text",
    text: "**项目结构待开发**\n\`root\`\n\nPlaceholder node.\n\n包含：\n- root (0 行)\n- init (0 个参数)\n\n依赖：0 个模块\n被依赖：0 次",
    x: 0,
    y: 0,
    width: 280,
    height: 160,
    color: "2",
    meta: {
      relPath: "root",
      category: "misc",
      group: "misc",
      side: "right",
    },
  };
  if (!existing.has(rootNode.id)) nodes.push(rootNode);
  return nodes;
}

function buildCanvasEdges(edges, nodeIndex) {
  const output = [];
  for (const edge of edges) {
    const fromNode = nodeIndex.get(edge.from);
    const toNode = nodeIndex.get(edge.to);
    if (!fromNode || !toNode) continue;
    const dir = edgeDirection(fromNode, toNode);
    output.push({
      id: `edge_${edge.from}_${edge.to}`,
      fromNode: edge.from,
      fromSide: dir.fromSide,
      toNode: edge.to,
      toSide: dir.toSide,
    });
  }
  return output;
}

async function buildCanvasModel({ rootDir }) {
  const warnings = [];
  const files = await scanSourceFiles(rootDir, warnings);
  if (files.length === 0) {
    const node = {
      id: `empty_${hashString(rootDir)}`,
      type: "text",
      text: "**项目结构待开发**\n\`empty\`\n\nNo source files detected.\n\n包含：\n- empty (0 行)\n- init (0 个参数)\n\n依赖：0 个模块\n被依赖：0 次",
      x: 0,
      y: 0,
      width: 280,
      height: 160,
      color: "2",
      meta: { relPath: "empty", category: "misc", group: "misc", side: "right" },
    };
    return {
      nodes: [node],
      edges: [],
      warnings,
      architecture: "库/工具项目",
    };
  }

  const fileIndex = new Set(files.map((f) => path.resolve(f)));
  const fileInfos = [];
  const externalServices = new Set();

  for (const absPath of files) {
    const relPath = path.relative(rootDir, absPath) || absPath;
    const content = await readFileSafe(absPath, warnings);
    const classification = classifyFile(relPath, content || "");
    const symbols = extractSymbols(relPath, content || "");
    const lineCount = countLines(content || "");
    const externalHits = detectExternalServices(content || "");
    for (const hit of externalHits) externalServices.add(hit);

    const side = isFrontSide(relPath) ? "left" : isBackSide(relPath) ? "right" : "right";

    const info = {
      absPath: path.resolve(absPath),
      relPath: toPosixPath(relPath),
      displayName: path.parse(relPath).name,
      category: classification.category,
      group: classification.group,
      color: classification.color,
      description: classification.description,
      symbols,
      lineCount,
      side,
      externalServices: Array.from(externalHits),
      imports: new Set(),
    };

    info.imports = extractLocalImports(info.absPath, content || "", fileIndex);
    fileInfos.push(info);
  }

  mergeSmallCategories(fileInfos, 3, { keepCategories: PROTECTED_CATEGORIES });

  const topDirs = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const topDirNames = topDirs.filter((d) => d.isDirectory()).map((d) => d.name);
  const configHits = [];
  for (const file of CONFIG_FILES) {
    if (await exists(path.join(rootDir, file))) configHits.push(file);
  }

  const architecture = detectArchitecture({
    rootDir,
    topDirs: topDirNames,
    configHits,
    fileInfos,
  });

  const { nodes: fileNodes, nodeByPath } = buildFileNodes(fileInfos);
  const { nodes: externalNodes, nodeByService } = buildExternalNodes(externalServices);
  let allNodes = fileNodes.concat(externalNodes);

  let edges = buildEdges(fileInfos, nodeByPath, nodeByService, fileIndex);

  if (ENABLE_AGGREGATION) {
    ({ nodes: allNodes, edges } = aggregateNodesIfNeeded(allNodes, edges, SOFT_NODE_LIMIT));
  }
  if (ENABLE_ISOLATED_GROUPING) {
    ({ nodes: allNodes, edges } = applyIsolatedGrouping(allNodes, edges));
  }

  edges = pruneEdges(edges, { maxEdges: 50, maxOut: 5, keepExternal: true, maxExternalEdges: 12, nodes: allNodes });
  allNodes = ensureMinimumNodes(allNodes);

  const depCounts = assignDependencyCounts(allNodes, edges);
  const infoByRel = new Map(fileInfos.map((info) => [info.relPath, info]));
  for (const node of allNodes) {
    if (node.groupInfo) {
      const counts = depCounts.get(node.id) || { outgoing: 0, incoming: 0 };
      const group = node.groupInfo;
      node.text = buildAggregatedText({
        displayName: group.displayName,
        description: group.description,
        samplePath: group.samplePath,
        sampleNames: group.sampleNames,
        fileCount: group.fileCount,
        outgoing: counts.outgoing,
        incoming: counts.incoming,
      });
      node.height = calculateNodeHeight(node.text);
      continue;
    }
    if (node.externalService) {
      const counts = depCounts.get(node.id) || { outgoing: 0, incoming: 0 };
      node.text = buildExternalText(node.externalService, counts);
      node.height = calculateNodeHeight(node.text);
      continue;
    }
    const info = infoByRel.get(node.meta.relPath);
    if (info) {
      const counts = depCounts.get(node.id) || { outgoing: 0, incoming: 0 };
      node.text = buildNodeText(info, counts);
      node.height = calculateNodeHeight(node.text);
    }
  }

  annotateLayers(allNodes);
  if (ENABLE_MODULE_GROUPS) {
    const grouped = layoutModulesAsGrid(allNodes, { modulePadding: 80, moduleGap: 220, startX: 100, startY: 100 });
    allNodes = grouped.groupNodes.concat(grouped.nodes);
  } else {
    layoutNodes(allNodes, edges, architecture);
  }

  const nodeIndex = new Map(allNodes.map((node) => [node.id, node]));
  const canvasEdges = buildCanvasEdges(edges, nodeIndex);

  return {
    nodes: allNodes,
    edges: canvasEdges,
    warnings,
    architecture,
  };
}

async function writeCanvasFile(outputPath, canvas) {
  const payload = JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }, null, 2) + "\n";
  await fs.writeFile(outputPath, payload, "utf8");
}

function outputSummary({ outputPath, nodes, edges, architecture }) {
  process.stdout.write(
    `✓ 架构图已生成：${outputPath}\n  节点数量：${nodes.length}\n  连接数量：${edges.length}\n  识别的架构模式：${architecture}\n`
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const rootDir = path.resolve(opts.root || process.cwd());
  const projectName = path.basename(rootDir);
  const preferredOut = opts.out ? path.resolve(opts.out) : path.join(rootDir, "architecture.canvas");
  let outputPath = preferredOut;

  let canvas;
  try {
    canvas = await buildCanvasModel({ rootDir });
    try {
      await writeCanvasFile(outputPath, canvas);
    } catch (err) {
      const fallback = path.join(os.homedir(), `architecture_${projectName}.canvas`);
      outputPath = fallback;
      await writeCanvasFile(outputPath, canvas);
    }

    if (canvas.warnings && canvas.warnings.length > 0) {
      const warningsPath = `${outputPath}.warnings.log`;
      await fs.writeFile(warningsPath, canvas.warnings.join("\n") + "\n", "utf8");
    }

    outputSummary({
      outputPath,
      nodes: canvas.nodes,
      edges: canvas.edges,
      architecture: canvas.architecture,
    });
  } catch (err) {
    const fallbackBase = path.join(os.homedir(), `architecture_${projectName}.canvas`);
    const errorPath = `${fallbackBase}.error.log`;
    const errorPayload = err && err.stack ? err.stack : String(err);
    await fs.writeFile(errorPath, errorPayload + "\n", "utf8").catch(() => null);
    if (canvas) {
      const partialPath = `${fallbackBase}.partial.json`;
      await fs
        .writeFile(partialPath, JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }, null, 2) + "\n", "utf8")
        .catch(() => null);
    }
    process.stderr.write(`Failed to generate architecture canvas. See ${errorPath}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCanvasModel,
  classifyFile,
  pruneEdges,
  aggregateNodesIfNeeded,
  scanSourceFiles,
};

if (require.main === module) {
  main();
}
