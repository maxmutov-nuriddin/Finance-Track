import { addDaysInTz, formatDateISO, formatISOWithOffset, getTzParts, makeTashkentDate } from "./timezone";
import { parseAmount } from "./parseAmount";

const CATEGORY_MAP = [
  { key: "food", words: ["еда", "обед", "ужин", "завтрак", "кофе", "чай", "ресторан", "кафе", "хот дог", "хотдог", "фастфуд", "бургер"] },
  { key: "transport", words: ["такси", "транспорт", "метро", "автобус", "проезд", "бензин", "топливо"] },
  { key: "credit", words: ["кредит", "долг", "рассрочка", "займ", "ипотека"] },
  { key: "rent", words: ["аренда", "квартира", "съем", "съём"] },
  { key: "health", words: ["аптека", "лекар", "врач", "клиника", "здоров"] }
];

const INCOME_WORDS = ["зп", "зарплата", "доход", "получил", "получила", "премия", "аванс", "бонус"];

const DATE_REGEX = /(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/;
const TIME_REGEX = /(\d{1,2}):(\d{2})/;
const DAYS_AGO_REGEX = /(\d+)\s*д(ень|ня|ней)\s*назад/;

function normalize(text) {
  return text.trim().toLowerCase();
}

function detectCategory(text) {
  for (const group of CATEGORY_MAP) {
    for (const word of group.words) {
      if (text.includes(word)) {
        return { key: group.key, matched: true };
      }
    }
  }
  return { key: "other", matched: false };
}

function detectType(text) {
  return INCOME_WORDS.some((word) => text.includes(word)) ? "income" : "expense";
}

function detectIncomePeriod(text) {
  if (/(зп|зарплат)/.test(text)) {
    return "monthly";
  }
  return null;
}

function stripTokens(text, tokens) {
  let result = text;
  for (const token of tokens) {
    if (!token) continue;
    result = result.replace(token, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}

function parseDateTime(rawText, nowDate, options = {}) {
  const warnings = [];
  const nowParts = getTzParts(nowDate);
  let dateParts = { ...nowParts };
  let hasDate = false;

  const relativeMap = {
    сегодня: 0,
    вчера: -1,
    позавчера: -2,
    завтра: 1,
    послезавтра: 2
  };

  let match = null;
  for (const [key, delta] of Object.entries(relativeMap)) {
    if (rawText.includes(key)) {
      const base = makeTashkentDate(nowParts);
      dateParts = addDaysInTz(base, delta);
      hasDate = true;
      break;
    }
  }

  if (!hasDate) {
    match = rawText.match(DAYS_AGO_REGEX);
    if (match) {
      const days = Number(match[1]);
      const base = makeTashkentDate(nowParts);
      dateParts = addDaysInTz(base, -days);
      hasDate = true;
    }
  }

  match = rawText.match(DATE_REGEX);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearRaw = match[3];
    const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : nowParts.year;
    dateParts = {
      ...dateParts,
      year,
      month,
      day
    };
    hasDate = true;
  }

  match = rawText.match(TIME_REGEX);
  let hasTime = false;
  if (match) {
    dateParts = {
      ...dateParts,
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: 0
    };
    hasTime = true;
  } else if (options.defaultTime) {
    dateParts = {
      ...dateParts,
      hour: options.defaultTime.hour,
      minute: options.defaultTime.minute,
      second: 0
    };
  }

  if (!hasDate && options.requireDate) {
    warnings.push("date_not_found");
  }

  if (!hasTime && options.requireTime) {
    warnings.push("time_not_found");
  }

  const occurredAtISO = formatISOWithOffset(dateParts);
  const occurredAtDate = makeTashkentDate(dateParts);

  return {
    dateParts,
    occurredAtISO,
    occurredAtDate,
    dateISO: formatDateISO(dateParts),
    hasDate,
    hasTime,
    warnings
  };
}

export function parseInput(rawText, nowDate = new Date()) {
  const text = normalize(rawText);
  const warnings = [];

  const type = detectType(text);
  const categoryResult = detectCategory(text);
  const category = categoryResult.key;
  const incomePeriod = type === "income" ? detectIncomePeriod(text) : null;

  const tokensToStrip = [];
  const dt = parseDateTime(text, nowDate);
  const cleanedForAmount = text
    .replace(DATE_REGEX, " ")
    .replace(TIME_REGEX, " ")
    .replace(DAYS_AGO_REGEX, " ");

  const amount = parseAmount(cleanedForAmount);
  if (!amount || Number.isNaN(amount)) {
    warnings.push("amount_not_found");
  }

  tokensToStrip.push(text.match(DATE_REGEX)?.[0]);
  tokensToStrip.push(text.match(TIME_REGEX)?.[0]);
  tokensToStrip.push(text.match(DAYS_AGO_REGEX)?.[0]);

  const description = stripTokens(rawText, tokensToStrip);

  return {
    amount: amount ? Math.round(amount) : amount,
    occurredAtISO: dt.occurredAtISO,
    occurredAtDate: dt.occurredAtDate,
    category,
    categoryDetected: categoryResult.matched,
    type,
    incomePeriod,
    description,
    warnings
  };
}

export function parsePaymentInput(rawText, nowDate = new Date()) {
  const text = normalize(rawText);
  const dt = parseDateTime(text, nowDate, {
    defaultTime: { hour: 10, minute: 0 },
    requireDate: true
  });

  const cleanedForAmount = text
    .replace(DATE_REGEX, " ")
    .replace(TIME_REGEX, " ")
    .replace(DAYS_AGO_REGEX, " ");

  const amount = parseAmount(cleanedForAmount);
  const warnings = [...dt.warnings];
  if (!amount || Number.isNaN(amount)) {
    warnings.push("amount_not_found");
  }

  const title = stripTokens(rawText, [text.match(DATE_REGEX)?.[0]]);
  const isMonthly = /(ежемесяч|каждый месяц|кажд(?:ый|ую)\s+месяц)/.test(text);

  return {
    amount: amount ? Math.round(amount) : amount,
    payDateISO: dt.dateISO,
    payDateTimeISO: dt.occurredAtISO,
    title: title || "Платеж",
    recurrence: isMonthly ? "monthly" : "oneTime",
    warnings
  };
}
