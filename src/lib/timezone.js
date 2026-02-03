export const TZ = "local";

export function getTzParts(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds()
  };
}

export function makeTashkentDate(parts) {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second || 0
  );
}

export function addDaysInTz(date, days) {
  const next = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return getTzParts(next);
}

export function addMonthsInTz(date, months) {
  const parts = getTzParts(date);
  const totalMonths = parts.year * 12 + (parts.month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  const daysInMonth = new Date(nextYear, nextMonth, 0).getDate();
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

function formatOffset(minutesOffset) {
  const sign = minutesOffset <= 0 ? "+" : "-";
  const abs = Math.abs(minutesOffset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function formatISOWithOffset(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second || 0
  );
  const offset = formatOffset(date.getTimezoneOffset());
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour
  )}:${pad(parts.minute)}:00${offset}`;
}

export function formatDateISO(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function nowInTashkent() {
  return new Date();
}

export function todayISO(now = new Date()) {
  const parts = getTzParts(now);
  return formatDateISO(parts);
}
