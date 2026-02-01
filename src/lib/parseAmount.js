export function parseAmount(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\u00A0/g, " ").trim().toLowerCase();
  const num = normalized.replace(/,/g, ".");

  const million = num.match(/(\d+(?:\.\d+)?)\s*(млн|миллион(?:а|ов)?)/);
  if (million) {
    return Math.round(Number(million[1]) * 1_000_000);
  }

  const thousand = num.match(/(\d+(?:\.\d+)?)\s*(тыс|тысяч)/);
  if (thousand) {
    return Math.round(Number(thousand[1]) * 1_000);
  }

  const plain = num.match(/(\d[\d\s]*)/);
  if (plain) {
    return Number(plain[1].replace(/\s+/g, ""));
  }

  return null;
}
