export function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("ru-RU").format(num).replace(/\u00A0/g, " ");
}
