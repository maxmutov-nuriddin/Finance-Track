export function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("ru-RU").format(num).replace(/\u00A0/g, " ");
}

export function formatCompact(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) {
    const v = Math.round((value / 1_000_000) * 10) / 10;
    return `${v}m`;
  }
  if (value >= 1_000) {
    const v = Math.round(value / 1_000);
    return `${v}k`;
  }
  return `${Math.round(value)}`;
}
