export function parseAmount(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\u00A0/g, " ").trim().toLowerCase();
  const num = normalized.replace(/,/g, ".");

  const million = num.match(
    /(\d+(?:\.\d+)?)\s*(млн\.?|миллион(?:а|ов)?|mln|million(?:s)?)/i
  );
  if (million) {
    return Math.round(Number(million[1]) * 1_000_000);
  }

  const thousand = num.match(
    /(\d+(?:\.\d+)?)\s*(тыс(?:яч)?|k|thousand(?:s)?|ming(?:ta)?)/i
  );
  if (thousand) {
    return Math.round(Number(thousand[1]) * 1_000);
  }

  const plain = num.match(/(\d[\d\s]*(?:\.\d+)?)/);
  if (plain) {
    return Math.round(Number(plain[1].replace(/\s+/g, "")));
  }

  return null;
}
