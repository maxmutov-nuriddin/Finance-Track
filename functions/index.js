const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TZ = "Asia/Tashkent";
const REGION = "asia-northeast1";
const APP_SITE_URL = String(process.env.FINANCE_TRACK_SITE_URL || "https://finance-track-7fadf.web.app").trim();
const TELEGRAM_ID_HELP_BOT = "@Get_myidrobot";
const FINANCE_TRACK_BOT = "@mvfintrackbot";
const SALARY_WORDS = [
  "зп",
  "зарплат",
  "зарплата",
  "salary",
  "maosh",
  "oylik",
  "аванс",
  "премия",
  "бонус"
];

function getDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

function formatDateISO(parts) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function addDays(parts, days) {
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const next = new Date(utcDate.getTime() + days * 24 * 60 * 60 * 1000);
  return getDateParts(next, "UTC");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getTransactionDate(item) {
  if (item?.occurredAtISO) {
    return new Date(item.occurredAtISO);
  }
  const raw = item?.occurredAt;
  if (raw?.toDate) {
    return raw.toDate();
  }
  if (raw instanceof Date) {
    return raw;
  }
  return null;
}

function getTransactionDateISO(item) {
  if (item?.occurredAtISO) {
    return String(item.occurredAtISO).slice(0, 10);
  }
  const date = getTransactionDate(item);
  if (!date) return "";
  return formatDateISO(getDateParts(date, TZ));
}

function isSalaryTransaction(item) {
  if (!item || item.type !== "income") return false;
  const text = `${item.description || ""} ${item.raw || ""}`.toLowerCase();
  return SALARY_WORDS.some((word) => text.includes(word));
}

function detectSalaryDay(transactions) {
  const now = new Date();
  const limitDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const salaryCandidates = [];

  transactions.forEach((item) => {
    if (item?.type !== "income") return;
    const date = getTransactionDate(item);
    if (!date || date < limitDate) return;
    const parts = getDateParts(date, TZ);
    const payload = { day: parts.day, date };
    if (isSalaryTransaction(item)) {
      salaryCandidates.push(payload);
    }
  });

  if (!salaryCandidates.length) return null;

  const stats = new Map();
  salaryCandidates.forEach((entry) => {
    const existing = stats.get(entry.day) || { count: 0, last: null };
    existing.count += 1;
    if (!existing.last || entry.date > existing.last) {
      existing.last = entry.date;
    }
    stats.set(entry.day, existing);
  });

  let bestDay = null;
  let bestCount = -1;
  let bestLast = null;
  for (const [day, info] of stats.entries()) {
    if (info.count > bestCount) {
      bestDay = day;
      bestCount = info.count;
      bestLast = info.last;
      continue;
    }
    if (info.count === bestCount && info.last && bestLast && info.last > bestLast) {
      bestDay = day;
      bestLast = info.last;
    }
  }
  return bestDay;
}

function getMonthRange(parts) {
  const start = { year: parts.year, month: parts.month, day: 1 };
  const end = { year: parts.year, month: parts.month, day: daysInMonth(parts.year, parts.month) };
  return {
    startISO: formatDateISO(start),
    endISO: formatDateISO(end)
  };
}

function getPreviousMonthRange(parts) {
  const year = parts.month === 1 ? parts.year - 1 : parts.year;
  const month = parts.month === 1 ? 12 : parts.month - 1;
  const start = { year, month, day: 1 };
  const end = { year, month, day: daysInMonth(year, month) };
  return {
    startISO: formatDateISO(start),
    endISO: formatDateISO(end)
  };
}

function getPreviousWeekRange(todayParts) {
  const endParts = addDays(todayParts, -1);
  const startParts = addDays(endParts, -6);
  return {
    startISO: formatDateISO(startParts),
    endISO: formatDateISO(endParts)
  };
}

function getLang(settings) {
  return settings?.language === "uz" ? "uz" : "ru";
}

function formatAmount(value, lang = "ru") {
  const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
  return Number(value || 0).toLocaleString(locale);
}

function formatSignedAmount(value, lang = "ru") {
  const num = Number(value || 0);
  const abs = formatAmount(Math.abs(num), lang);
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
}

function parseTelegramChatId(settings) {
  const raw = String(settings?.telegramChatId || "").trim();
  if (!raw) return null;
  if (!/^-?\d+$/.test(raw)) return null;
  return raw;
}

function remindersEnabled(settings) {
  return Boolean(settings?.remindersEnabled);
}

function telegramEnabled(settings) {
  if (!remindersEnabled(settings)) return false;
  if (settings?.telegramEnabled === false) return false;
  return Boolean(parseTelegramChatId(settings));
}

async function sendTelegramMessage(chatId, text, token) {
  if (!chatId || !token || !text) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Telegram sendMessage failed", response.status, body);
      return false;
    }

    const payload = await response.json();
    return Boolean(payload?.ok);
  } catch (error) {
    console.error("Telegram sendMessage error", error);
    return false;
  }
}

async function getUserSettings(userRef) {
  const snap = await userRef.collection("settings").doc("main").get();
  return snap.exists ? snap.data() : {};
}

async function getUserTokens(userRef) {
  const snap = await userRef.collection("fcmTokens").get();
  return snap.docs.map((doc) => doc.id);
}

async function getRecentTransactions(userRef, max = 1500) {
  const snap = await userRef
    .collection("transactions")
    .orderBy("occurredAtISO", "desc")
    .limit(max)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getRecentDebts(userRef, max = 400) {
  const snap = await userRef
    .collection("debts")
    .orderBy("createdAt", "desc")
    .limit(max)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function inISODateRange(dateISO, startISO, endISO) {
  if (!dateISO) return false;
  return dateISO >= startISO && dateISO <= endISO;
}

function filterTransactionsByRange(transactions, startISO, endISO) {
  return (transactions || []).filter((item) => inISODateRange(getTransactionDateISO(item), startISO, endISO));
}

function computeTransactionStats(transactions) {
  let income = 0;
  let expense = 0;

  (transactions || []).forEach((item) => {
    const amount = Number(item?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (item?.type === "income") {
      income += amount;
    }
    if (item?.type === "expense") {
      expense += amount;
    }
  });

  return {
    income,
    expense,
    net: income - expense,
    count: (transactions || []).length
  };
}

function debtDaysDiff(targetISO, todayParts) {
  if (!targetISO) return null;
  const [year, month, day] = String(targetISO)
    .slice(0, 10)
    .split("-")
    .map((value) => Number(value));
  if (!year || !month || !day) return null;

  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function classifyDebts(debts, todayParts) {
  const result = {
    openCount: 0,
    openTotal: 0,
    overdue: [],
    soon: []
  };

  (debts || []).forEach((debt) => {
    const remaining = Number(debt?.remaining || 0);
    if (debt?.isClosed || remaining <= 0) return;

    result.openCount += 1;
    result.openTotal += remaining;

    const dueISO = String(debt?.dueDateISO || "").slice(0, 10);
    if (!dueISO) return;

    const diff = debtDaysDiff(dueISO, todayParts);
    if (diff === null) return;

    const item = {
      title: debt?.title || "",
      remaining,
      dueDateISO: dueISO,
      diff
    };

    if (diff < 0) {
      result.overdue.push(item);
    } else if (diff <= 3) {
      result.soon.push(item);
    }
  });

  result.overdue.sort((a, b) => a.diff - b.diff);
  result.soon.sort((a, b) => a.diff - b.diff);
  return result;
}

function buildPaymentReminderText(payment, lang) {
  const title = payment?.title || (lang === "uz" ? "To'lov" : "Платёж");
  const amount = formatAmount(payment?.amount || 0, lang);

  if (lang === "uz") {
    return [
      "🔔 To'lov eslatmasi",
      `📅 3 kundan keyin: ${title}`,
      `💰 Summa: ${amount}`,
      "✍️ To'lovdan oldin yozuvlarni tekshirib chiqing."
    ].join("\n");
  }

  return [
    "🔔 Напоминание о платеже",
    `📅 Через 3 дня: ${title}`,
    `💰 Сумма: ${amount}`,
    "✍️ Перед оплатой проверь записи и баланс."
  ].join("\n");
}

function buildSalaryReminderText(lang) {
  if (lang === "uz") {
    return [
      "💼 Ertaga maosh kuni",
      "Byudjetni yangilang va kunlik limitni tekshirib qo'ying."
    ].join("\n");
  }

  return [
    "💼 Завтра день зарплаты",
    "Обнови бюджет и проверь дневной лимит на новый период."
  ].join("\n");
}

function buildTelegramWelcomeText(lang) {
  if (lang === "uz") {
    return [
      "🎉 Finance Track ulandi!",
      "Hisobotlar va eslatmalar endi shu chatga keladi.",
      "",
      `🌐 Sayt: ${APP_SITE_URL}`,
      `🤖 Bot: ${FINANCE_TRACK_BOT}`,
      `🆔 ID olish: ${TELEGRAM_ID_HELP_BOT} (/start yozing)`,
      "",
      "Keyingi qadamlar:",
      "1) Saytga kiring.",
      "2) Sozlamalar -> Telegram hisobotlar bo'limini oching.",
      "3) Telegram ID ni saqlang va eslatmalarni yoqing.",
      "4) «Hisobot yuborish» tugmasi bilan tekshiring."
    ].join("\n");
  }

  return [
    "🎉 Finance Track подключен!",
    "Отчёты и напоминания теперь будут приходить в этот чат.",
    "",
    `🌐 Сайт: ${APP_SITE_URL}`,
    `🤖 Бот: ${FINANCE_TRACK_BOT}`,
    `🆔 Где взять ID: ${TELEGRAM_ID_HELP_BOT} (напиши /start)`,
    "",
    "Что делать дальше:",
    "1) Войди на сайт.",
    "2) Открой Настройки -> Telegram отчёты.",
    "3) Сохрани Telegram ID и включи напоминания.",
    "4) Нажми «Отправить отчёт» для проверки."
  ].join("\n");
}

function getTelegramLangFromMessage(message) {
  const code = String(message?.from?.language_code || message?.from?.languageCode || "").toLowerCase();
  return code.startsWith("uz") ? "uz" : "ru";
}

function buildTelegramStartReply(lang, chatId) {
  const idLine =
    lang === "uz"
      ? `🆔 Sizning Telegram ID: ${chatId}`
      : `🆔 Ваш Telegram ID: ${chatId}`;

  if (lang === "uz") {
    return [
      buildTelegramWelcomeText(lang),
      "",
      idLine,
      "",
      "Foydali buyruqlar:",
      "/id - Telegram ID ni qayta ko'rsatish",
      "/help - qisqa yordam"
    ].join("\n");
  }

  return [
    buildTelegramWelcomeText(lang),
    "",
    idLine,
    "",
    "Полезные команды:",
    "/id - показать Telegram ID",
    "/help - короткая помощь"
  ].join("\n");
}

function buildTelegramHelpReply(lang, chatId) {
  if (lang === "uz") {
    return [
      "ℹ️ Yordam",
      `🆔 Telegram ID: ${chatId}`,
      `🌐 Sayt: ${APP_SITE_URL}`,
      `🤖 Bot: ${FINANCE_TRACK_BOT}`,
      "",
      "Qadamlar:",
      "1) Saytda Sozlamalar -> Telegram hisobotlar bo'limini oching.",
      "2) Telegram ID ni kiriting va saqlang.",
      "3) «Barcha eslatmalar»ni yoqing.",
      "4) «Hisobot yuborish» bilan tekshiring.",
      "",
      `Agar ID ko'rinmasa: ${TELEGRAM_ID_HELP_BOT}`
    ].join("\n");
  }

  return [
    "ℹ️ Помощь",
    `🆔 Telegram ID: ${chatId}`,
    `🌐 Сайт: ${APP_SITE_URL}`,
    `🤖 Бот: ${FINANCE_TRACK_BOT}`,
    "",
    "Шаги:",
    "1) На сайте открой Настройки -> Telegram отчёты.",
    "2) Введи Telegram ID и сохрани.",
    "3) Включи «Все напоминания».",
    "4) Нажми «Отправить отчёт» для проверки.",
    "",
    `Если ID не видно: ${TELEGRAM_ID_HELP_BOT}`
  ].join("\n");
}

function buildMorningStatusText({ lang, todayISO, settings, todayStats, monthStats, debtInfo }) {
  const dailyLimit = Number(settings?.dailyLimitValue || 0);
  const dailySpent = Number(todayStats?.expense || 0);
  const dailyRemaining = dailyLimit - dailySpent;

  if (lang === "uz") {
    return [
      `🌅 Xayrli tong! ${todayISO}`,
      "━━━━━━━━━━━━",
      `👛 Hamyon: ${formatAmount(settings?.walletBalance || 0, lang)}`,
      `🎯 Bugungi limit: ${formatAmount(dailyLimit, lang)}`,
      `💸 Bugun sarflangan: ${formatAmount(dailySpent, lang)}`,
      `⚖️ Limit qoldig'i: ${formatSignedAmount(dailyRemaining, lang)}`,
      "",
      "📅 Joriy oy",
      `• Kirim: ${formatAmount(monthStats.income, lang)}`,
      `• Chiqim: ${formatAmount(monthStats.expense, lang)}`,
      `• Balans: ${formatSignedAmount(monthStats.net, lang)}`,
      `🤝 Ochiq qarzlar: ${debtInfo.openCount} (${formatAmount(debtInfo.openTotal, lang)})`
    ].join("\n");
  }

  return [
    `🌅 Доброе утро! ${todayISO}`,
    "━━━━━━━━━━━━",
    `👛 Кошелёк: ${formatAmount(settings?.walletBalance || 0, lang)}`,
    `🎯 Лимит на сегодня: ${formatAmount(dailyLimit, lang)}`,
    `💸 Потрачено сегодня: ${formatAmount(dailySpent, lang)}`,
    `⚖️ Остаток лимита: ${formatSignedAmount(dailyRemaining, lang)}`,
    "",
    "📅 Текущий месяц",
    `• Доход: ${formatAmount(monthStats.income, lang)}`,
    `• Расход: ${formatAmount(monthStats.expense, lang)}`,
    `• Баланс: ${formatSignedAmount(monthStats.net, lang)}`,
    `🤝 Открытых долгов: ${debtInfo.openCount} (${formatAmount(debtInfo.openTotal, lang)})`
  ].join("\n");
}

function buildDailyReportText({ lang, todayISO, todayStats, monthStats, settings, debtInfo }) {
  if (lang === "uz") {
    return [
      `📘 Kunlik hisobot · ${todayISO}`,
      "━━━━━━━━━━━━",
      `💵 Bugungi kirim: ${formatAmount(todayStats.income, lang)}`,
      `💸 Bugungi chiqim: ${formatAmount(todayStats.expense, lang)}`,
      `⚖️ Bugungi natija: ${formatSignedAmount(todayStats.net, lang)}`,
      "",
      "📅 Joriy oy",
      `• Kirim: ${formatAmount(monthStats.income, lang)}`,
      `• Chiqim: ${formatAmount(monthStats.expense, lang)}`,
      `• Balans: ${formatSignedAmount(monthStats.net, lang)}`,
      "",
      `👛 Hamyon: ${formatAmount(settings?.walletBalance || 0, lang)}`,
      `🎯 Kunlik limit: ${formatAmount(settings?.dailyLimitValue || 0, lang)}`,
      `🤝 Ochiq qarzlar: ${debtInfo.openCount} (${formatAmount(debtInfo.openTotal, lang)})`
    ].join("\n");
  }

  return [
    `📘 Дневной отчёт · ${todayISO}`,
    "━━━━━━━━━━━━",
    `💵 Доход сегодня: ${formatAmount(todayStats.income, lang)}`,
    `💸 Расход сегодня: ${formatAmount(todayStats.expense, lang)}`,
    `⚖️ Итог сегодня: ${formatSignedAmount(todayStats.net, lang)}`,
    "",
    "📅 Текущий месяц",
    `• Доход: ${formatAmount(monthStats.income, lang)}`,
    `• Расход: ${formatAmount(monthStats.expense, lang)}`,
    `• Баланс: ${formatSignedAmount(monthStats.net, lang)}`,
    "",
    `👛 Кошелёк: ${formatAmount(settings?.walletBalance || 0, lang)}`,
    `🎯 Дневной лимит: ${formatAmount(settings?.dailyLimitValue || 0, lang)}`,
    `🤝 Открытых долгов: ${debtInfo.openCount} (${formatAmount(debtInfo.openTotal, lang)})`
  ].join("\n");
}

function buildWeeklyReportText({ lang, range, stats }) {
  if (lang === "uz") {
    return [
      "📗 Haftalik hisobot",
      `📅 ${range.startISO} - ${range.endISO}`,
      "━━━━━━━━━━━━",
      `💵 Kirim: ${formatAmount(stats.income, lang)}`,
      `💸 Chiqim: ${formatAmount(stats.expense, lang)}`,
      `⚖️ Natija: ${formatSignedAmount(stats.net, lang)}`,
      `🧾 Yozuvlar: ${stats.count}`
    ].join("\n");
  }

  return [
    "📗 Недельный отчёт",
    `📅 ${range.startISO} - ${range.endISO}`,
    "━━━━━━━━━━━━",
    `💵 Доход: ${formatAmount(stats.income, lang)}`,
    `💸 Расход: ${formatAmount(stats.expense, lang)}`,
    `⚖️ Итог: ${formatSignedAmount(stats.net, lang)}`,
    `🧾 Записей: ${stats.count}`
  ].join("\n");
}

function buildMonthlyReportText({ lang, range, stats }) {
  if (lang === "uz") {
    return [
      "📙 Oylik hisobot",
      `📅 ${range.startISO} - ${range.endISO}`,
      "━━━━━━━━━━━━",
      `💵 Kirim: ${formatAmount(stats.income, lang)}`,
      `💸 Chiqim: ${formatAmount(stats.expense, lang)}`,
      `⚖️ Natija: ${formatSignedAmount(stats.net, lang)}`,
      `🧾 Yozuvlar: ${stats.count}`
    ].join("\n");
  }

  return [
    "📙 Месячный отчёт",
    `📅 ${range.startISO} - ${range.endISO}`,
    "━━━━━━━━━━━━",
    `💵 Доход: ${formatAmount(stats.income, lang)}`,
    `💸 Расход: ${formatAmount(stats.expense, lang)}`,
    `⚖️ Итог: ${formatSignedAmount(stats.net, lang)}`,
    `🧾 Записей: ${stats.count}`
  ].join("\n");
}

function buildRecordReminderText(lang, period) {
  if (lang === "uz") {
    if (period === "noon") {
      return [
        "⏰ Eslatma",
        "Tushgacha bo'lgan kirim va chiqimlarni yozib qo'ying."
      ].join("\n");
    }
    return [
      "⏰ Eslatma",
      "Kechqurun barcha kirim va chiqimlarni yozishni unutmang."
    ].join("\n");
  }

  if (period === "noon") {
    return [
      "⏰ Напоминание",
      "Запиши доходы и расходы до обеда."
    ].join("\n");
  }
  return [
    "⏰ Напоминание",
    "К вечеру запиши все расходы и доходы за день."
  ].join("\n");
}

function buildDebtAlertText(lang, debtInfo) {
  const hasAlerts = debtInfo.overdue.length || debtInfo.soon.length;
  if (!hasAlerts) return "";

  const topOverdue = debtInfo.overdue.slice(0, 3);
  const topSoon = debtInfo.soon.slice(0, 3);

  if (lang === "uz") {
    const lines = [
      "⚠️ Qarzlar bo'yicha ogohlantirish",
      `🔴 Muddati o'tgan: ${debtInfo.overdue.length}`,
      `🟡 Yaqin 3 kun: ${debtInfo.soon.length}`
    ];

    if (topOverdue.length) lines.push("", "🔴 Muddati o'tganlar:");
    topOverdue.forEach((item) => {
      lines.push(`• ${item.title || "Qarz"} — ${formatAmount(item.remaining, lang)} (${Math.abs(item.diff)} kun kechikdi)`);
    });

    if (topSoon.length) lines.push("", "🟡 Yaqin muddatdagilar:");
    topSoon.forEach((item) => {
      lines.push(`• ${item.title || "Qarz"} — ${formatAmount(item.remaining, lang)} (${item.diff} kun qoldi)`);
    });
    return lines.join("\n");
  }

  const lines = [
    "⚠️ Внимание по долгам",
    `🔴 Просрочено: ${debtInfo.overdue.length}`,
    `🟡 Срок до 3 дней: ${debtInfo.soon.length}`
  ];

  if (topOverdue.length) lines.push("", "🔴 Просроченные:");
  topOverdue.forEach((item) => {
    lines.push(`• ${item.title || "Долг"} — ${formatAmount(item.remaining, lang)} (${Math.abs(item.diff)} дн. просрочки)`);
  });

  if (topSoon.length) lines.push("", "🟡 Скоро срок:");
  topSoon.forEach((item) => {
    lines.push(`• ${item.title || "Долг"} — ${formatAmount(item.remaining, lang)} (через ${item.diff} дн.)`);
  });
  return lines.join("\n");
}

async function forEachTelegramUser(handler) {
  const db = admin.firestore();
  const token = TELEGRAM_BOT_TOKEN.value();
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const userRef = userDoc.ref;
    const settings = await getUserSettings(userRef);
    if (!telegramEnabled(settings)) continue;

    const chatId = parseTelegramChatId(settings);
    if (!chatId) continue;

    const lang = getLang(settings);

    try {
      await handler({ db, uid: userDoc.id, userRef, settings, chatId, lang, token });
    } catch (error) {
      console.error(`Telegram user handler failed for ${userDoc.id}`, error);
    }
  }
}

exports.telegramWebhook = onRequest(
  {
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(200).send("ok");
      return;
    }

    const token = TELEGRAM_BOT_TOKEN.value();
    if (!token) {
      console.warn("TELEGRAM_BOT_TOKEN is not set");
      res.status(200).json({ ok: false });
      return;
    }

    const update = req.body || {};
    const message = update?.message || update?.edited_message || null;
    const chatId = String(message?.chat?.id || "").trim();
    const rawText = String(message?.text || "").trim();
    const command = rawText.split(/\s+/)[0].toLowerCase();

    if (!chatId || !command) {
      res.status(200).json({ ok: true });
      return;
    }

    const lang = getTelegramLangFromMessage(message);

    if (command === "/start") {
      await sendTelegramMessage(chatId, buildTelegramStartReply(lang, chatId), token);
    } else if (command === "/id") {
      const text = lang === "uz" ? `🆔 Sizning Telegram ID: ${chatId}` : `🆔 Ваш Telegram ID: ${chatId}`;
      await sendTelegramMessage(chatId, text, token);
    } else if (command === "/help") {
      await sendTelegramMessage(chatId, buildTelegramHelpReply(lang, chatId), token);
    } else {
      const text =
        lang === "uz"
          ? "Buyruq tushunilmadi. /start, /id yoki /help dan foydalaning."
          : "Команда не распознана. Используй /start, /id или /help.";
      await sendTelegramMessage(chatId, text, token);
    }

    res.status(200).json({ ok: true });
  }
);

exports.telegramWelcomeOnConnect = onDocumentWritten(
  {
    document: "users/{uid}/settings/main",
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async (event) => {
    const token = TELEGRAM_BOT_TOKEN.value();
    if (!token) {
      console.warn("TELEGRAM_BOT_TOKEN is not set");
      return;
    }

    const before = event.data?.before?.exists ? event.data.before.data() : {};
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return;

    const beforeChatId = parseTelegramChatId(before);
    const afterChatId = parseTelegramChatId(after);
    if (!afterChatId) return;
    if (after?.telegramEnabled === false) return;

    const chatChanged = beforeChatId !== afterChatId;
    if (!chatChanged) return;

    const lang = getLang(after);
    const sent = await sendTelegramMessage(afterChatId, buildTelegramWelcomeText(lang), token);
    if (sent) {
      await event.data.after.ref.set(
        { telegramOnboardingSentAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }
);

exports.telegramOnboardingBroadcast = onSchedule(
  {
    schedule: "5 10 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    await forEachTelegramUser(async ({ userRef, settings, chatId, lang, token }) => {
      if (settings?.telegramOnboardingSentAt) return;
      const sent = await sendTelegramMessage(chatId, buildTelegramWelcomeText(lang), token);
      if (!sent) return;
      await userRef.collection("settings").doc("main").set(
        { telegramOnboardingSentAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
  }
);

exports.notifyUpcomingPayments = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const todayParts = getDateParts(new Date(), TZ);
    const targetParts = addDays(todayParts, 3);
    const targetDateISO = formatDateISO(targetParts);
    const todayISO = formatDateISO(todayParts);

    const paymentsSnap = await db
      .collectionGroup("payments")
      .where("payDateISO", "==", targetDateISO)
      .get();

    if (paymentsSnap.empty) return;

    const telegramToken = TELEGRAM_BOT_TOKEN.value();

    for (const payDoc of paymentsSnap.docs) {
      const payment = payDoc.data();
      if (payment.lastNotifiedAtISO === todayISO) continue;

      const userRef = payDoc.ref.parent.parent;
      if (!userRef) continue;

      const settings = await getUserSettings(userRef);
      if (!remindersEnabled(settings)) continue;

      const lang = getLang(settings);
      let didSend = false;

      const tokens = await getUserTokens(userRef);
      if (tokens.length) {
        const notification =
          lang === "uz"
            ? {
                title: "To'lov eslatmasi",
                body: `3 kundan keyin: ${payment.title} — ${formatAmount(payment.amount, lang)}`
              }
            : {
                title: "Напоминание о платеже",
                body: `Через 3 дня: ${payment.title} — ${formatAmount(payment.amount, lang)}`
              };

        try {
          const response = await messaging.sendEachForMulticast({ notification, tokens });
          const batch = db.batch();
          response.responses.forEach((res, index) => {
            if (!res.success) {
              batch.delete(userRef.collection("fcmTokens").doc(tokens[index]));
            }
          });
          await batch.commit();
          didSend = true;
        } catch (error) {
          console.error("FCM notifyUpcomingPayments failed", error);
        }
      }

      if (telegramEnabled(settings) && telegramToken) {
        const chatId = parseTelegramChatId(settings);
        const text = buildPaymentReminderText(payment, lang);
        const sent = await sendTelegramMessage(chatId, text, telegramToken);
        if (sent) didSend = true;
      }

      if (didSend) {
        await payDoc.ref.set({ lastNotifiedAtISO: todayISO }, { merge: true });
      }
    }
  }
);

exports.notifySalaryDay = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const todayParts = getDateParts(new Date(), TZ);
    const todayISO = formatDateISO(todayParts);
    const tomorrowParts = addDays(todayParts, 1);
    const telegramToken = TELEGRAM_BOT_TOKEN.value();

    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) return;

    for (const userDoc of usersSnap.docs) {
      const userRef = userDoc.ref;
      const settingsRef = userRef.collection("settings").doc("main");
      const settingsSnap = await settingsRef.get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};
      if (!remindersEnabled(settings)) continue;
      if (settings?.salaryReminderLastISO === todayISO) continue;

      const txSnap = await userRef
        .collection("transactions")
        .orderBy("occurredAtISO", "desc")
        .limit(300)
        .get();
      const transactions = txSnap.docs.map((doc) => doc.data());

      const manualSalaryDay = Math.round(Number(settings?.salaryDayOfMonth || 0));
      const salaryDay =
        Number.isFinite(manualSalaryDay) && manualSalaryDay >= 1 && manualSalaryDay <= 31
          ? manualSalaryDay
          : detectSalaryDay(transactions);

      if (!salaryDay) continue;

      const monthDays = daysInMonth(tomorrowParts.year, tomorrowParts.month);
      const salaryDayThisMonth = Math.min(salaryDay, monthDays);
      if (tomorrowParts.day !== salaryDayThisMonth) continue;

      const lang = getLang(settings);
      let didSend = false;

      const tokens = await getUserTokens(userRef);
      if (tokens.length) {
        const notification =
          lang === "uz"
            ? {
                title: "Ertaga maosh",
                body: "Ertaga maosh kuni. Byudjetni tayyorlab qo'ying."
              }
            : {
                title: "Завтра зарплата",
                body: "Завтра день зарплаты. Подготовь бюджет."
              };

        try {
          const response = await messaging.sendEachForMulticast({ notification, tokens });
          const batch = db.batch();
          response.responses.forEach((res, index) => {
            if (!res.success) {
              batch.delete(userRef.collection("fcmTokens").doc(tokens[index]));
            }
          });
          await batch.commit();
          didSend = true;
        } catch (error) {
          console.error("FCM notifySalaryDay failed", error);
        }
      }

      if (telegramEnabled(settings) && telegramToken) {
        const chatId = parseTelegramChatId(settings);
        const sent = await sendTelegramMessage(chatId, buildSalaryReminderText(lang), telegramToken);
        if (sent) didSend = true;
      }

      if (didSend) {
        await settingsRef.set({ salaryReminderLastISO: todayISO }, { merge: true });
      }
    }
  }
);

exports.telegramMorningStatus = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const todayParts = getDateParts(new Date(), TZ);
    const todayISO = formatDateISO(todayParts);

    await forEachTelegramUser(async ({ userRef, settings, chatId, lang, token }) => {
      const transactions = await getRecentTransactions(userRef);
      const monthRange = getMonthRange(todayParts);
      const todayStats = computeTransactionStats(filterTransactionsByRange(transactions, todayISO, todayISO));
      const monthStats = computeTransactionStats(
        filterTransactionsByRange(transactions, monthRange.startISO, monthRange.endISO)
      );
      const debts = await getRecentDebts(userRef);
      const debtInfo = classifyDebts(debts, todayParts);

      const text = buildMorningStatusText({
        lang,
        todayISO,
        settings,
        todayStats,
        monthStats,
        debtInfo
      });

      await sendTelegramMessage(chatId, text, token);

      const debtAlert = buildDebtAlertText(lang, debtInfo);
      if (debtAlert) {
        await sendTelegramMessage(chatId, debtAlert, token);
      }
    });
  }
);

exports.telegramNoonReminder = onSchedule(
  {
    schedule: "0 12 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    await forEachTelegramUser(async ({ chatId, lang, token }) => {
      await sendTelegramMessage(chatId, buildRecordReminderText(lang, "noon"), token);
    });
  }
);

exports.telegramEveningReminder = onSchedule(
  {
    schedule: "0 18 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    await forEachTelegramUser(async ({ chatId, lang, token }) => {
      await sendTelegramMessage(chatId, buildRecordReminderText(lang, "evening"), token);
    });
  }
);

exports.telegramDailyReport = onSchedule(
  {
    schedule: "0 22 * * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const todayParts = getDateParts(new Date(), TZ);
    const todayISO = formatDateISO(todayParts);

    await forEachTelegramUser(async ({ userRef, settings, chatId, lang, token }) => {
      const transactions = await getRecentTransactions(userRef);
      const monthRange = getMonthRange(todayParts);
      const todayStats = computeTransactionStats(filterTransactionsByRange(transactions, todayISO, todayISO));
      const monthStats = computeTransactionStats(
        filterTransactionsByRange(transactions, monthRange.startISO, monthRange.endISO)
      );
      const debts = await getRecentDebts(userRef);
      const debtInfo = classifyDebts(debts, todayParts);

      
      const text = buildDailyReportText({
        lang,
        todayISO,
        todayStats,
        monthStats,
        settings,
        debtInfo
      });

      await sendTelegramMessage(chatId, text, token);
    });
  }
);

exports.telegramWeeklyReport = onSchedule(
  {
    schedule: "0 0 * * 1",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const todayParts = getDateParts(new Date(), TZ);
    const range = getPreviousWeekRange(todayParts);

    await forEachTelegramUser(async ({ userRef, chatId, lang, token }) => {
      const transactions = await getRecentTransactions(userRef);
      const stats = computeTransactionStats(
        filterTransactionsByRange(transactions, range.startISO, range.endISO)
      );

      await sendTelegramMessage(chatId, buildWeeklyReportText({ lang, range, stats }), token);
    });
  }
);

exports.telegramMonthlyReport = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: TZ,
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN]
  },
  async () => {
    const todayParts = getDateParts(new Date(), TZ);
    const range = getPreviousMonthRange(todayParts);

    await forEachTelegramUser(async ({ userRef, chatId, lang, token }) => {
      const transactions = await getRecentTransactions(userRef);
      const stats = computeTransactionStats(
        filterTransactionsByRange(transactions, range.startISO, range.endISO)
      );

      await sendTelegramMessage(chatId, buildMonthlyReportText({ lang, range, stats }), token);
    });
  }
);

