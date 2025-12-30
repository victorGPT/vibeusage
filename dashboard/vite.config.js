import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COPY_REQUIRED_KEYS = [
  'landing.meta.title',
  'landing.meta.description',
  'landing.meta.og_site_name',
  'landing.meta.og_type',
  'landing.meta.og_image',
  'landing.meta.og_url',
  'landing.meta.twitter_card'
];

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const COPY_PATH = path.join(ROOT_DIR, 'src', 'content', 'copy.csv');

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = raw[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      field = '';
      if (!row.every((cell) => cell.trim() === '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (!row.every((cell) => cell.trim() === '')) {
    rows.push(row);
  }

  return rows;
}

function loadCopyRegistry() {
  let raw = '';
  try {
    raw = fs.readFileSync(COPY_PATH, 'utf8');
  } catch (error) {
    console.warn('[vibescore] Failed to read copy registry:', error.message);
    return new Map();
  }

  const rows = parseCsv(raw);
  if (!rows.length) return new Map();

  const header = rows[0].map((cell) => cell.trim());
  const keyIndex = header.indexOf('key');
  const textIndex = header.indexOf('text');
  if (keyIndex === -1 || textIndex === -1) {
    console.warn('[vibescore] Copy registry missing key/text columns.');
    return new Map();
  }

  const map = new Map();
  rows.slice(1).forEach((cells) => {
    const key = String(cells[keyIndex] || '').trim();
    if (!key) return;
    const text = String(cells[textIndex] ?? '').trim();
    map.set(key, text);
  });

  return map;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMeta() {
  const map = loadCopyRegistry();
  const read = (key) => map.get(key) || '';

  const missing = COPY_REQUIRED_KEYS.filter((key) => !map.has(key));
  if (missing.length) {
    console.warn('[vibescore] Copy registry missing keys:', missing.join(', '));
  }

  return {
    title: read('landing.meta.title'),
    description: read('landing.meta.description'),
    ogSiteName: read('landing.meta.og_site_name'),
    ogType: read('landing.meta.og_type'),
    ogImage: read('landing.meta.og_image'),
    ogUrl: read('landing.meta.og_url'),
    twitterCard: read('landing.meta.twitter_card')
  };
}

function injectRichMeta(html) {
  const meta = buildMeta();
  const replacements = {
    '__VIBESCORE_TITLE__': meta.title,
    '__VIBESCORE_DESCRIPTION__': meta.description,
    '__VIBESCORE_OG_SITE_NAME__': meta.ogSiteName,
    '__VIBESCORE_OG_TITLE__': meta.title,
    '__VIBESCORE_OG_DESCRIPTION__': meta.description,
    '__VIBESCORE_OG_IMAGE__': meta.ogImage,
    '__VIBESCORE_OG_TYPE__': meta.ogType,
    '__VIBESCORE_OG_URL__': meta.ogUrl,
    '__VIBESCORE_TWITTER_CARD__': meta.twitterCard,
    '__VIBESCORE_TWITTER_TITLE__': meta.title,
    '__VIBESCORE_TWITTER_DESCRIPTION__': meta.description,
    '__VIBESCORE_TWITTER_IMAGE__': meta.ogImage
  };

  let output = html;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replaceAll(token, escapeHtml(value));
  }
  return output;
}

function richLinkMetaPlugin() {
  return {
    name: 'vibescore-rich-link-meta',
    transformIndexHtml(html) {
      return injectRichMeta(html);
    }
  };
}

export default defineConfig({
  plugins: [react(), richLinkMetaPlugin()],
  server: {
    port: 5173,
    // Prefer 5173 for local CLI integration, but don't fail if already in use.
    strictPort: false
  }
});
