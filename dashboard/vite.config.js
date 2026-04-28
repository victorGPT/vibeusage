import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { transformSync } from "esbuild";
import { defineConfig, loadEnv } from "vite";
import copyRegistryModule from "../src/shared/copy-registry.cjs";

const COPY_REQUIRED_KEYS = [
  "landing.meta.title",
  "landing.meta.description",
  "landing.meta.og_site_name",
  "landing.meta.og_type",
  "landing.meta.og_image",
  "landing.meta.og_url",
  "landing.meta.twitter_card",
  "share.meta.title",
  "share.meta.description",
  "share.meta.og_site_name",
  "share.meta.og_type",
  "share.meta.og_image",
  "share.meta.og_url",
  "share.meta.twitter_card",
];

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const COPY_PATH = path.join(ROOT_DIR, "src", "content", "copy.csv");
const PACKAGE_JSON_PATH = path.resolve(ROOT_DIR, "..", "package.json");
const { buildCopyRegistry } = copyRegistryModule;

function loadAppVersion() {
  try {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed?.version || "").trim() || null;
  } catch (error) {
    console.warn("[vibeusage] Failed to read package.json version:", error.message);
    return null;
  }
}

function loadCopyRegistry() {
  let raw = "";
  try {
    raw = fs.readFileSync(COPY_PATH, "utf8");
  } catch (error) {
    console.warn("[vibeusage] Failed to read copy registry:", error.message);
    return new Map();
  }

  const registry = buildCopyRegistry(raw);
  if (!registry.header.length) return new Map();
  if (registry.missingColumns.length) {
    console.warn("[vibeusage] Copy registry missing columns:", registry.missingColumns.join(", "));
    return new Map();
  }

  const map = new Map();
  registry.rows.forEach((record) => {
    map.set(record.key, record.text);
  });

  return map;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMeta(prefix = "landing") {
  const map = loadCopyRegistry();
  const read = (key) => map.get(`${prefix}.meta.${key}`) || "";

  const missing = COPY_REQUIRED_KEYS.filter((key) => !map.has(key));
  if (missing.length) {
    console.warn("[vibeusage] Copy registry missing keys:", missing.join(", "));
  }

  return {
    title: read("title"),
    description: read("description"),
    ogSiteName: read("og_site_name"),
    ogType: read("og_type"),
    ogImage: read("og_image"),
    ogUrl: read("og_url"),
    twitterCard: read("twitter_card"),
  };
}

function resolveMetaPrefix(ctx) {
  const rawPath = String(ctx?.path || ctx?.filename || ctx?.originalUrl || "").toLowerCase();
  if (rawPath.includes("share")) return "share";
  if (rawPath.includes("wrapped-2025")) return "share";
  return "landing";
}

function injectRichMeta(html, prefix) {
  const meta = buildMeta(prefix);
  const replacements = {
    __VIBEUSAGE_TITLE__: meta.title,
    __VIBEUSAGE_DESCRIPTION__: meta.description,
    __VIBEUSAGE_OG_SITE_NAME__: meta.ogSiteName,
    __VIBEUSAGE_OG_TITLE__: meta.title,
    __VIBEUSAGE_OG_DESCRIPTION__: meta.description,
    __VIBEUSAGE_OG_IMAGE__: meta.ogImage,
    __VIBEUSAGE_OG_TYPE__: meta.ogType,
    __VIBEUSAGE_OG_URL__: meta.ogUrl,
    __VIBEUSAGE_TWITTER_CARD__: meta.twitterCard,
    __VIBEUSAGE_TWITTER_TITLE__: meta.title,
    __VIBEUSAGE_TWITTER_DESCRIPTION__: meta.description,
    __VIBEUSAGE_TWITTER_IMAGE__: meta.ogImage,
  };

  let output = html;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replaceAll(token, escapeHtml(value));
  }
  return output;
}

function richLinkMetaPlugin() {
  return {
    name: "vibeusage-rich-link-meta",
    transformIndexHtml(html, ctx) {
      return injectRichMeta(html, resolveMetaPrefix(ctx));
    },
  };
}

// Transform `.cjs` files imported from outside the dashboard root into ESM
// during dev. Vite 7 stopped doing this automatically for files served via
// `/@fs/`, so the dashboard hits a "module does not provide default export"
// error on `import x from "../../../src/shared/*.cjs"`.
function cjsToEsmPlugin() {
  return {
    name: "vibeusage-cjs-to-esm",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".cjs")) return null;
      const result = transformSync(code, {
        loader: "js",
        format: "esm",
        target: "esnext",
        sourcefile: id,
        sourcemap: false,
      });
      return { code: result.code, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT_DIR, "VITE_");
  const fallbackVersion = loadAppVersion();
  const define = {};

  if (!env.VITE_APP_VERSION && fallbackVersion) {
    define["import.meta.env.VITE_APP_VERSION"] = JSON.stringify(fallbackVersion);
  }

  return {
    plugins: [cjsToEsmPlugin(), react(), richLinkMetaPlugin()],
    ...(Object.keys(define).length ? { define } : {}),
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(ROOT_DIR, "index.html"),
          share: path.resolve(ROOT_DIR, "share.html"),
          wrapped: path.resolve(ROOT_DIR, "wrapped-2025.html"),
        },
      },
    },
    server: {
      port: 5173,
      // Prefer 5173 for local CLI integration, but don't fail if already in use.
      strictPort: false,
    },
  };
});
