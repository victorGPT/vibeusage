const assert = require("node:assert/strict");
const { test } = require("node:test");

test("buildFleetData keeps usage tokens for fleet rows", async () => {
  const mod = await import("../dashboard/src/lib/model-breakdown.js");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "gpt-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 }
          }
        ]
      },
      {
        source: "api",
        totals: { total_tokens: 0, total_cost_usd: 0 },
        models: []
      }
    ]
  };

  assert.equal(typeof buildFleetData, "function");

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData.length, 1);
  assert.equal(fleetData[0].label, "CLI");
  assert.equal(fleetData[0].usage, 1200);
  assert.equal(fleetData[0].totalPercent, "100.0");
});

test("buildFleetData returns model ids for stable keys", async () => {
  const mod = await import("../dashboard/src/lib/model-breakdown.js");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "GPT-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 }
          }
        ]
      }
    ]
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].models[0].id, "gpt-4o");
});

test("buildTopModels aggregates by model_id across sources", async () => {
  const mod = await import("../dashboard/src/lib/model-breakdown.js");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [
          { model: "GPT-4o", model_id: "gpt-4o", totals: { total_tokens: 70 } }
        ]
      },
      {
        source: "api",
        models: [
          { model: "GPT-4o", model_id: "gpt-4o", totals: { total_tokens: 50 } },
          { model: "GPT-4o-mini", model_id: "gpt-4o-mini", totals: { total_tokens: 30 } }
        ]
      }
    ]
  };

  assert.equal(typeof buildTopModels, "function");

  const topModels = buildTopModels(modelBreakdown, { limit: 3 });

  assert.equal(topModels.length, 2);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].name, "GPT-4o");
  assert.equal(topModels[0].percent, "80.0");
  assert.equal(topModels[1].id, "gpt-4o-mini");
  assert.equal(topModels[1].percent, "20.0");
});

test("buildTopModels computes percent using total tokens across all models", async () => {
  const mod = await import("../dashboard/src/lib/model-breakdown.js");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [
          { model: "legacy-model", totals: { total_tokens: 50 } }
        ]
      },
      {
        source: "api",
        models: [
          { model: "GPT-4o", model_id: "gpt-4o", totals: { total_tokens: 50 } }
        ]
      }
    ]
  };

  const topModels = buildTopModels(modelBreakdown, { limit: 3 });

  assert.equal(topModels.length, 1);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].percent, "50.0");
});
