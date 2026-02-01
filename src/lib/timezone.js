export const TZ = "Asia/Tashkent";
export const TZ_OFFSET_HOURS = 5;

const formatterCache = new Map();

function getFormatter(tz) {
  if (!formatterCache.has(tz)) {
    formatterCache.set(
      tz,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
    );
  }
  return formatterCache.get(tz);
}

export function getTzParts(date = new Date(), tz = TZ) {
  const parts = getFormatter(tz).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

export function makeTashkentDate(parts) {
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour - TZ_OFFSET_HOURS,
    parts.minute,
    parts.second || 0
  );
  return new Date(utcMs);
}

export function addDaysInTz(date, days, tz = TZ) {
  const next = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return getTzParts(next, tz);
}

export function addMonthsInTz(date, months, tz = TZ) {
  const parts = getTzParts(date, tz);
  const totalMonths = parts.year * 12 + (parts.month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const daysInMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextDay = Math.min(parts.day, daysInMonth);
  return {
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second || 0
  };
}

export function formatISOWithOffset(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour
  )}:${pad(parts.minute)}:00+05:00`;
}

export function formatDateISO(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function nowInTashkent() {
  return makeTashkentDate(getTzParts(new Date()));
}

export function todayISO(now = new Date()) {
  const parts = getTzParts(now);
  return formatDateISO(parts);
}
