const assert = require("node:assert/strict");
const { test } = require("node:test");

test("getMockUsageModelBreakdown includes model_id per model", async () => {
  const mod = await import("../dashboard/src/lib/mock-data.js");
  const getMockUsageModelBreakdown = mod.getMockUsageModelBreakdown;

  const data = getMockUsageModelBreakdown({
    from: "2024-01-01",
    to: "2024-01-01",
    seed: "mock-seed",
  });

  const models = (data?.sources || []).flatMap((source) =>
    Array.isArray(source?.models) ? source.models : []
  );

  assert.ok(models.length > 0, "expected mock models");
  for (const model of models) {
    assert.equal(typeof model?.model_id, "string");
    assert.ok(model.model_id.length > 0);
  }
});
