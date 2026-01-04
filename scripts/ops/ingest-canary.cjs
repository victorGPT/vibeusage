#!/usr/bin/env node

'use strict';

const baseUrl =
  process.env.VIBESCORE_CANARY_BASE_URL ||
  process.env.VIBESCORE_INSFORGE_BASE_URL ||
  process.env.INSFORGE_BASE_URL ||
  '';
const deviceToken = process.env.VIBESCORE_CANARY_DEVICE_TOKEN || '';

if (!baseUrl) {
  console.error('Missing base URL: set VIBESCORE_CANARY_BASE_URL or VIBESCORE_INSFORGE_BASE_URL');
  process.exit(2);
}

if (!deviceToken) {
  console.error('Missing device token: set VIBESCORE_CANARY_DEVICE_TOKEN');
  process.exit(2);
}

const confirmIsolated = normalizeFlag(process.env.VIBESCORE_CANARY_CONFIRM_ISOLATED);
if (!confirmIsolated) {
  console.error('Refusing to run canary without isolation confirmation.');
  console.error('Set VIBESCORE_CANARY_CONFIRM_ISOLATED=1 and use a dedicated user token.');
  console.error('Also disable leaderboard for that user to avoid public exposure.');
  process.exit(2);
}

const source = process.env.VIBESCORE_CANARY_SOURCE || 'canary';
const model = process.env.VIBESCORE_CANARY_MODEL || 'canary';
const hourStart = process.env.VIBESCORE_CANARY_HOUR_START || currentHalfHourIso();
const allowCustomTag = normalizeFlag(process.env.VIBESCORE_CANARY_ALLOW_CUSTOM_TAG);

if (!allowCustomTag && (!isCanaryTag(source) || !isCanaryTag(model))) {
  console.error('Refusing to run canary with non-canary source/model.');
  console.error('Set VIBESCORE_CANARY_ALLOW_CUSTOM_TAG=1 to override.');
  process.exit(2);
}

if (!isHalfHourIso(hourStart)) {
  console.error('Invalid VIBESCORE_CANARY_HOUR_START: must be UTC half-hour boundary ISO');
  process.exit(2);
}

const inputTokens = toNonNegativeInt(process.env.VIBESCORE_CANARY_INPUT_TOKENS) ?? 0;
const cachedTokens = toNonNegativeInt(process.env.VIBESCORE_CANARY_CACHED_TOKENS) ?? 0;
const outputTokens = toNonNegativeInt(process.env.VIBESCORE_CANARY_OUTPUT_TOKENS) ?? 0;
const reasoningTokens = toNonNegativeInt(process.env.VIBESCORE_CANARY_REASONING_TOKENS) ?? 0;
const totalTokensEnv = toNonNegativeInt(process.env.VIBESCORE_CANARY_TOTAL_TOKENS);
const totalTokens = totalTokensEnv ?? inputTokens + cachedTokens + outputTokens + reasoningTokens;

const payload = {
  hourly: [
    {
      hour_start: hourStart,
      source,
      model,
      input_tokens: inputTokens,
      cached_input_tokens: cachedTokens,
      output_tokens: outputTokens,
      reasoning_output_tokens: reasoningTokens,
      total_tokens: totalTokens
    }
  ]
};

const url = new URL('/functions/vibeusage-ingest', baseUrl).toString();

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Canary ingest failed: HTTP ${res.status}`);
    if (text) console.error(text);
    process.exit(1);
  }

  console.log(text || JSON.stringify({ success: true }));
}

function currentHalfHourIso() {
  const now = new Date();
  const minutes = now.getUTCMinutes();
  const bucketMinutes = minutes >= 30 ? 30 : 0;
  const dt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    bucketMinutes,
    0,
    0
  ));
  return dt.toISOString();
}

function isHalfHourIso(value) {
  if (typeof value !== 'string') return false;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return false;
  const minutes = dt.getUTCMinutes();
  return (minutes === 0 || minutes === 30) && dt.getUTCSeconds() === 0 && dt.getUTCMilliseconds() === 0;
}

function isCanaryTag(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'canary';
}

function toNonNegativeInt(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 0) return null;
  return n;
}

function normalizeFlag(value) {
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}
