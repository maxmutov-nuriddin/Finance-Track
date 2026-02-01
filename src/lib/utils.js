import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "./timezone";

export function getPeriodRange(days) {
  const now = new Date();
  const nowParts = getTzParts(now);
  const todayStartParts = { ...nowParts, hour: 0, minute: 0, second: 0 };
  const todayStart = makeTashkentDate(todayStartParts);
  const startParts = addDaysInTz(todayStart, -(days - 1));
  const start = makeTashkentDate({ ...startParts, hour: 0, minute: 0, second: 0 });
  const end = makeTashkentDate(nowParts);
  return {
    startISO: formatDateISO(getTzParts(start)),
    endISO: formatDateISO(getTzParts(end)),
    start,
    end
  };
}

export function getMonthRangeFor(date = new Date()) {
  const parts = getTzParts(date);
  const start = makeTashkentDate({
    year: parts.year,
    month: parts.month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0
  });
  const nextMonthYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
  const nextMonthStart = makeTashkentDate({
    year: nextMonthYear,
    month: nextMonth,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0
  });
  const end = new Date(nextMonthStart.getTime() - 1000);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  return {
    startISO: formatDateISO(getTzParts(start)),
    endISO: formatDateISO(getTzParts(end)),
    start,
    end,
    days
  };
}

export function getMonthRange() {
  return getMonthRangeFor(new Date());
}

export function getMonthKey(date = new Date()) {
  const parts = getTzParts(date);
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}`;
}

export function dedupById(items) {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function filterByOccurredAtISO(items, start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return items.filter((item) => {
    if (!item?.occurredAtISO) return false;
    const ms = new Date(item.occurredAtISO).getTime();
    return ms >= startMs && ms <= endMs;
  });
}

export function sumBy(items, predicate) {
  return items.reduce((sum, item) => sum + (predicate(item) || 0), 0);
}
