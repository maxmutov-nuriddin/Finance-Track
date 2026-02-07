import { addDaysInTz, formatDateISO, formatISOWithOffset, getTzParts, makeTashkentDate } from "./timezone";
import { parseAmount } from "./parseAmount";

const CATEGORY_MAP = [
  { key: "cafe", words: ["кафе", "ресторан", "бар", "кофе", "чай", "фастфуд", "бургер", "хот дог", "хотдог"] },
  { key: "groceries", words: ["продукты", "супермаркет", "магазин", "рынок", "пятерочка", "магнит", "корзинка"] },
  { key: "food", words: ["еда", "обед", "ужин", "завтрак"] },
  { key: "transport", words: ["такси", "транспорт", "метро", "автобус", "проезд", "бензин", "топливо"] },
  { key: "clothes", words: ["одежда", "обувь", "куртка", "футболка", "кроссовки"] },
  { key: "beauty", words: ["косметика", "салон", "парикмахер", "ногти", "маникюр", "педикюр", "spa"] },
  { key: "kids", words: ["дети", "ребенок", "ребёнок", "садик", "школа", "игрушки"] },
  { key: "gifts", words: ["подарок", "подарки", "цветы"] },
  { key: "pets", words: ["кот", "кошка", "собака", "корм", "ветеринар", "питомец"] },
  { key: "travel", words: ["путешествие", "отпуск", "поездка", "авиабилет", "отель", "билет"] },
  { key: "home", words: ["дом", "ремонт", "мебель", "техника", "лампа", "диван"] },
  { key: "subscriptions", words: ["подписка", "spotify", "netflix", "youtube", "apple", "google"] },
  { key: "taxes", words: ["налог", "налоги", "штраф", "госпошлина"] },
  { key: "entertainment", words: ["развлечения", "кино", "игры", "театр", "концерт"] },
  { key: "shopping", words: ["покупки", "маркетплейс", "ozon", "wildberries"] },
  { key: "utilities", words: ["коммуналка", "свет", "газ", "вода", "жкх"] },
  { key: "health", words: ["аптека", "лекар", "врач", "клиника", "здоров"] },
  { key: "education", words: ["курсы", "обучение", "университет", "учеба", "учёба", "школа"] },
  { key: "personal", words: ["личное", "себе", "хобби"] },
  { key: "debt", words: ["долг", "должен", "должна", "занял", "заняла", "занять", "одолжил", "одолжила", "одолжить", "долги", "займ", "займы"] },
  { key: "credit", words: ["кредит", "рассрочка", "ипотека"] },
  { key: "rent", words: ["аренда", "квартира", "съем", "съём"] }
];

const CATEGORY_MAP_UZ = [
  { key: "cafe", words: ["kafe", "restoran", "bar", "qahva", "choy", "fastfood"] },
  { key: "groceries", words: ["mahsulot", "oziq-ovqat", "supermarket", "bozor", "dokon", "do'kon"] },
  { key: "food", words: ["ovqat", "tushlik", "kechki ovqat", "nonushta"] },
  { key: "transport", words: ["taksi", "transport", "metro", "avtobus", "benzin", "yoqilgi", "yoqilg'i"] },
  { key: "clothes", words: ["kiyim", "poyabzal", "krossovka"] },
  { key: "beauty", words: ["gozallik", "go'zallik", "salon", "sartarosh", "manikyur", "pedikyur"] },
  { key: "kids", words: ["bola", "bolalar", "bogcha", "bog'cha", "maktab", "oyinchoq", "o'yinchoq"] },
  { key: "gifts", words: ["sovga", "sovg'a", "gul"] },
  { key: "pets", words: ["mushuk", "it", "veterinar", "hayvon"] },
  { key: "travel", words: ["sayohat", "tatil", "ta'til", "aviachipta", "mehmonxona"] },
  { key: "home", words: ["uy", "tamir", "ta'mir", "mebel", "texnika"] },
  { key: "subscriptions", words: ["obuna"] },
  { key: "taxes", words: ["soliq", "jarima"] },
  { key: "entertainment", words: ["oyin-kulgi", "o'yin-kulgi", "kino", "oyin", "o'yin", "konsert"] },
  { key: "shopping", words: ["xarid", "xaridlar", "marketpleys", "uzum"] },
  { key: "utilities", words: ["kommunal", "komunal", "elektr", "gaz", "suv"] },
  { key: "health", words: ["dori", "dorixona", "shifokor", "klinika", "sogliq", "sog'liq"] },
  { key: "education", words: ["kurs", "talim", "ta'lim", "universitet", "oqish", "o'qish"] },
  { key: "personal", words: ["shaxsiy", "hobby", "hobbi"] },
  { key: "debt", words: ["qarz", "qarzlar"] },
  { key: "credit", words: ["kredit", "ipoteka"] },
  { key: "rent", words: ["ijara"] }
];

const INCOME_WORDS = [
  "зп",
  "зарплата",
  "доход",
  "получил",
  "получила",
  "премия",
  "аванс",
  "бонус",
  "maosh",
  "oylik",
  "daromad",
  "kirim",
  "tushum"
];
const GOAL_WORDS = [
  "цель",
  "maqsad",
  "goal",
  "накопить",
  "накопление",
  "коплю",
  "jamgar",
  "jamg'ar",
  "yigaman",
  "yig'aman"
];
const DEBT_HINT_WORDS = ["долг", "долги", "займ", "займы", "qarz", "debt", "loan"];

const DATE_REGEX = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/;
const TIME_REGEX = /(\d{1,2}):(\d{2})/;
const DAYS_AGO_REGEX = /(\d+)\s*(?:д(?:ень|ня|ней)\s*назад|kun\s*(?:oldin|avval))/;

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ’`]/g, "'");
}

function detectCategory(text) {
  const categorySets = [...CATEGORY_MAP, ...CATEGORY_MAP_UZ];
  for (const group of categorySets) {
    for (const word of group.words) {
      if (text.includes(word)) {
        return { key: group.key, matched: true };
      }
    }
  }
  return { key: "other", matched: false };
}

function detectType(text) {
  if (GOAL_WORDS.some((word) => text.includes(word))) return "goal";
  return INCOME_WORDS.some((word) => text.includes(word)) ? "income" : "expense";
}

function detectIncomePeriod(text) {
  if (/(зп|зарплат|maosh|oylik|har\s*oy)/.test(text)) {
    return "monthly";
  }
  return null;
}

function detectDebtMode(text) {
  const hasDebtHint =
    DEBT_HINT_WORDS.some((word) => text.includes(word)) ||
    /(занял|заняла|одолжил|одолжила|qarz|debt|loan)/.test(text);
  if (!hasDebtHint) return null;

  if (
    /(отдал|отдала|вернул(?!и)|вернула|погасил|погасила|закрыл|закрыла|выплатил|выплатила|repay|repaid|pay\s*back|paid\s*back|qarzni?\s*(to'la|tolad|to'lad|to'ladi|qaytar|qaytard|qaytardi))/.test(
      text
    )
  ) {
    return "repay";
  }

  if (
    /(забрал|забрала|получил\s+обратно|получила\s+обратно|вернули|возвратили|взыскал|взыскала|collect|collected|qarzni?\s*(oldim|oldi|qaytarib\s+oldim|undirdim|undirdi))/.test(
      text
    )
  ) {
    return "collect";
  }

  if (
    /(взял|взяла|занял|заняла|одолжил\s+у|одолжила\s+у|borrow|borrowed|took\s+loan|qarz\s*ol(dim|di)?)/.test(
      text
    )
  ) {
    return "borrow";
  }

  if (
    /(дал|дала|одолжил(?!\s+у)|одолжила(?!\s+у)|lend|loaned|qarz\s*ber(dim|di)?)/.test(
      text
    )
  ) {
    return "lend";
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
    послезавтра: 2,
    bugun: 0,
    kecha: -1,
    indin: -2,
    ertaga: 1,
    indinga: 2
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
  const debtMode = detectDebtMode(text);

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
    debtMode,
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
  const isMonthly =
    /(ежемесяч|каждый месяц|кажд(?:ый|ую)\s+месяц|oylik|har\s*oy|har\s*oyi|oyma-oy|oymaoy)/.test(
      text
    );

  return {
    amount: amount ? Math.round(amount) : amount,
    payDateISO: dt.dateISO,
    payDateTimeISO: dt.occurredAtISO,
    title: title || "Payment",
    recurrence: isMonthly ? "monthly" : "oneTime",
    warnings
  };
}
