export function formatDateUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function getRangeForPeriod(period) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = formatDateUTC(today);

  if (period === "day") {
    return { from: to, to };
  }

  if (period === "week") {
    const fromDate = new Date(today);
    fromDate.setUTCDate(fromDate.getUTCDate() - fromDate.getUTCDay()); // Sunday start
    const toDate = new Date(fromDate);
    toDate.setUTCDate(toDate.getUTCDate() + 6);
    return { from: formatDateUTC(fromDate), to: formatDateUTC(toDate) };
  }

  if (period === "month") {
    const fromDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const toDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { from: formatDateUTC(fromDate), to: formatDateUTC(toDate) };
  }

  // "total" (all-time): sentinel from date; backend only returns days that exist.
  if (period === "total") {
    return { from: "2000-01-01", to };
  }

  // Default to week (safe fallback)
  return getRangeForPeriod("week");
}

export function getDefaultRange() {
  const today = new Date();
  const to = formatDateUTC(today);
  const from = formatDateUTC(
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 29
      )
    )
  );
  return { from, to };
}
