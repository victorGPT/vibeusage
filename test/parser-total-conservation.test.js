const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeClaudeUsage,
  normalizeKimiUsage,
  normalizeOpencodeTokens,
  normalizeGeminiTokens,
  normalizeUsage,
} = require("../src/lib/rollout");

/**
 * Token-conservation property test.
 *
 * Catches the April 2026 under-counting bug shape up-front: whenever a
 * normalize<Source>Usage function composes total_tokens itself (i.e. the
 * upstream payload does not carry a trusted `total_tokens`), the resulting
 * total must equal the sum of all four public channels the function reports.
 *
 * AGENTS.md "新 AI CLI Source 接入 Checklist" requires every new source to
 * obey this invariant — wire the new normalizer into CASES below so the
 * property is enforced from the first PR.
 */

function nonneg(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function assertChannelsNonNegative(out) {
  for (const k of [
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
  ]) {
    assert.ok(nonneg(out[k]), `${k} must be a non-negative finite number, got ${out[k]}`);
  }
}

function channelSum(out) {
  return (
    Number(out.input_tokens) +
    Number(out.cached_input_tokens) +
    Number(out.output_tokens) +
    Number(out.reasoning_output_tokens)
  );
}

function rng(seed) {
  // Small LCG for deterministic fuzz inputs — no dev-dependency needed.
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomInt(rand, max) {
  return Math.floor(rand() * max);
}

// ----- Sources whose total_tokens MUST equal the channel sum when they own
//       the composition (upstream does not provide total_tokens). -----

const COMPOSE_CASES = [
  {
    name: "normalizeClaudeUsage (Opus-like cache-heavy fuzz)",
    build(rand) {
      // Mimic realistic Claude Opus bucket: small input, any cache_read, small output.
      return {
        input_tokens: randomInt(rand, 1000),
        cache_creation_input_tokens: randomInt(rand, 50_000),
        cache_read_input_tokens: randomInt(rand, 500_000),
        output_tokens: randomInt(rand, 10_000),
      };
    },
    fn: normalizeClaudeUsage,
  },
  {
    name: "normalizeKimiUsage",
    build(rand) {
      return {
        input_other: randomInt(rand, 5000),
        input_cache_creation: randomInt(rand, 20_000),
        input_cache_read: randomInt(rand, 100_000),
        output: randomInt(rand, 5000),
      };
    },
    fn: normalizeKimiUsage,
  },
  {
    name: "normalizeOpencodeTokens",
    build(rand) {
      return {
        input: randomInt(rand, 1000),
        output: randomInt(rand, 1000),
        reasoning: randomInt(rand, 500),
        cache: {
          read: randomInt(rand, 80_000),
          write: randomInt(rand, 30_000),
        },
      };
    },
    fn: normalizeOpencodeTokens,
  },
];

for (const c of COMPOSE_CASES) {
  test(`${c.name}: total_tokens equals the sum of reported channels`, () => {
    const rand = rng(0xC0FFEE + c.name.length);
    for (let i = 0; i < 200; i += 1) {
      const input = c.build(rand);
      const out = c.fn(input);
      assert.ok(out && typeof out === "object", `${c.name} should return an object`);
      assertChannelsNonNegative(out);
      const sum = channelSum(out);
      assert.equal(
        out.total_tokens,
        sum,
        `[${c.name}] total_tokens (${out.total_tokens}) must equal channel sum (${sum}) for input ${JSON.stringify(input)}`,
      );
    }
  });

  test(`${c.name}: zero input stays zero`, () => {
    const out = c.fn({});
    if (out == null) return; // some normalizers may reject null input; fine
    assertChannelsNonNegative(out);
    assert.equal(channelSum(out), 0);
    assert.equal(out.total_tokens, 0);
  });
}

// ----- Sources that trust an upstream total_tokens stay permissive but must
//       still produce non-negative channels and must not silently synthesize a
//       total that is less than the sum of the channels they report. -----

test("normalizeGeminiTokens: channels non-negative; total honors upstream total", () => {
  const rand = rng(0xDECAF);
  for (let i = 0; i < 100; i += 1) {
    const total = randomInt(rand, 500_000);
    const input = {
      input: randomInt(rand, 1000),
      cached: randomInt(rand, 10_000),
      output: randomInt(rand, 1000),
      tool: randomInt(rand, 500),
      thoughts: randomInt(rand, 500),
      total,
    };
    const out = normalizeGeminiTokens(input);
    assertChannelsNonNegative(out);
    assert.equal(out.total_tokens, total, "Gemini trusts upstream total verbatim");
  }
});

test("normalizeUsage (Codex): channels non-negative and stable under fuzz", () => {
  const rand = rng(0xFEED);
  for (let i = 0; i < 100; i += 1) {
    const input = {
      input_tokens: randomInt(rand, 2000),
      cached_input_tokens: randomInt(rand, 50_000),
      output_tokens: randomInt(rand, 1000),
      reasoning_output_tokens: randomInt(rand, 500),
      total_tokens: randomInt(rand, 300_000),
    };
    const out = normalizeUsage(input);
    assertChannelsNonNegative(out);
    // normalizeUsage is pure field-level normalization; it does not re-compose
    // total, so we only assert it round-trips non-negative finite values.
    assert.equal(out.total_tokens, input.total_tokens);
  }
});

// Extra regression: lock in the shape of the April 2026 bug so a future edit
// that removes cache_read from Claude's total stands out immediately.
test("normalizeClaudeUsage: cache_read is accounted for in total_tokens", () => {
  const out = normalizeClaudeUsage({
    input_tokens: 100,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 10_000, // the channel the old parser dropped
    output_tokens: 50,
  });
  assert.equal(out.input_tokens, 300); // 100 + 200
  assert.equal(out.cached_input_tokens, 10_000);
  assert.equal(out.output_tokens, 50);
  assert.equal(out.reasoning_output_tokens, 0);
  // Must sum all four or the bug is back.
  assert.equal(out.total_tokens, 300 + 10_000 + 50);
});
