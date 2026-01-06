function toBigIntValue(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (value == null) return 0n;
  const raw = String(value).trim();
  if (!raw || !/^-?\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch (_e) {
    return 0n;
  }
}

export function sumDailyRowsToTotals(rows) {
  const totals = {
    total_tokens: 0n,
    billable_total_tokens: 0n,
    input_tokens: 0n,
    cached_input_tokens: 0n,
    output_tokens: 0n,
    reasoning_output_tokens: 0n,
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    totals.total_tokens += toBigIntValue(row?.total_tokens);
    totals.billable_total_tokens += toBigIntValue(
      row?.billable_total_tokens ?? row?.total_tokens
    );
    totals.input_tokens += toBigIntValue(row?.input_tokens);
    totals.cached_input_tokens += toBigIntValue(row?.cached_input_tokens);
    totals.output_tokens += toBigIntValue(row?.output_tokens);
    totals.reasoning_output_tokens += toBigIntValue(row?.reasoning_output_tokens);
  }

  return {
    total_tokens: totals.total_tokens.toString(),
    billable_total_tokens: totals.billable_total_tokens.toString(),
    input_tokens: totals.input_tokens.toString(),
    cached_input_tokens: totals.cached_input_tokens.toString(),
    output_tokens: totals.output_tokens.toString(),
    reasoning_output_tokens: totals.reasoning_output_tokens.toString(),
  };
}
