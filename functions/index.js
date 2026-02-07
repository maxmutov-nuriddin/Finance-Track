const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TZ = "Asia/Tashkent";
const REGION = "asia-northeast1";
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
  if (lang === "uz") {
    return `To'lov eslatmasi\n3 kundan keyin: ${payment.title || "To'lov"}\nSumma: ${formatAmount(payment.amount, lang)}`;
  }
  return `Напоминание о платеже\nЧерез 3 дня: ${payment.title || "Платёж"}\nСумма: ${formatAmount(payment.amount, lang)}`;
}

function buildSalaryReminderText(lang) {
  if (lang === "uz") {
    return "Ertaga maosh kuni. Byudjetni tekshirib qo'ying.";
  }
  return "Завтра день зарплаты. Проверь бюджет на новый период.";
}

function buildTelegramWelcomeText(lang) {
  if (lang === "uz") {
    return [
      "Xush kelibsiz!",
      "Siz Finance Track Telegram botini muvaffaqiyatli uladingiz.",
      "Endi eslatmalar va hisobotlar shu yerga keladi."
    ].join("\n");
  }

  return [
    "Добро пожаловать!",
    "Вы успешно подключили Telegram-бот Finance Track.",
    "Теперь отчеты и напоминания будут приходить сюда."
  ].join("\n");
}

function buildMorningStatusText({ lang, todayISO, settings, todayStats, monthStats, debtInfo }) {
  if (lang === "uz") {
    return [
      `Xayrli tong! ${todayISO}`,
      `Bugungi limit: ${formatAmount(settings?.dailyLimitValue || 0, lang)}`,
      `Bugun sarflangan: ${formatAmount(todayStats.expense, lang)}`,
      `Hamyon: ${formatAmount(settings?.walletBalance || 0, lang)}`,
      `Oy bo'yicha xarajat: ${formatAmount(monthStats.expense, lang)}`,
      `Ochiq qarzlar: ${debtInfo.openCount}`
    ].join("\n");
  }

  return [
    `Доброе утро! ${todayISO}`,
    `Лимит на сегодня: ${formatAmount(settings?.dailyLimitValue || 0, lang)}`,
    `Потрачено сегодня: ${formatAmount(todayStats.expense, lang)}`,
    `Кошелёк: ${formatAmount(settings?.walletBalance || 0, lang)}`,
    `Расход за месяц: ${formatAmount(monthStats.expense, lang)}`,
    `Открытых долгов: ${debtInfo.openCount}`
  ].join("\n");
}

function buildDailyReportText({ lang, todayISO, todayStats, monthStats, settings, debtInfo }) {
  if (lang === "uz") {
    return [
      `Kunlik hisobot: ${todayISO}`,
      `Kirim: ${formatAmount(todayStats.income, lang)}`,
      `Chiqim: ${formatAmount(todayStats.expense, lang)}`,
      `Natija: ${formatAmount(todayStats.net, lang)}`,
      `Oy bo'yicha kirim: ${formatAmount(monthStats.income, lang)}`,
      `Oy bo'yicha chiqim: ${formatAmount(monthStats.expense, lang)}`,
      `Hamyon: ${formatAmount(settings?.walletBalance || 0, lang)}`,
      `Qarzlar (ochiq): ${debtInfo.openCount}`
    ].join("\n");
  }

  return [
    `Дневной отчёт: ${todayISO}`,
    `Доход: ${formatAmount(todayStats.income, lang)}`,
    `Расход: ${formatAmount(todayStats.expense, lang)}`,
    `Итог: ${formatAmount(todayStats.net, lang)}`,
    `Доход за месяц: ${formatAmount(monthStats.income, lang)}`,
    `Расход за месяц: ${formatAmount(monthStats.expense, lang)}`,
    `Кошелёк: ${formatAmount(settings?.walletBalance || 0, lang)}`,
    `Открытых долгов: ${debtInfo.openCount}`
  ].join("\n");
}

function buildWeeklyReportText({ lang, range, stats }) {
  if (lang === "uz") {
    return [
      `Haftalik hisobot (${range.startISO} - ${range.endISO})`,
      `Kirim: ${formatAmount(stats.income, lang)}`,
      `Chiqim: ${formatAmount(stats.expense, lang)}`,
      `Natija: ${formatAmount(stats.net, lang)}`,
      `Yozuvlar: ${stats.count}`
    ].join("\n");
  }

  return [
    `Недельный отчёт (${range.startISO} - ${range.endISO})`,
    `Доход: ${formatAmount(stats.income, lang)}`,
    `Расход: ${formatAmount(stats.expense, lang)}`,
    `Итог: ${formatAmount(stats.net, lang)}`,
    `Записей: ${stats.count}`
  ].join("\n");
}

function buildMonthlyReportText({ lang, range, stats }) {
  if (lang === "uz") {
    return [
      `Oylik hisobot (${range.startISO} - ${range.endISO})`,
      `Kirim: ${formatAmount(stats.income, lang)}`,
      `Chiqim: ${formatAmount(stats.expense, lang)}`,
      `Natija: ${formatAmount(stats.net, lang)}`,
      `Yozuvlar: ${stats.count}`
    ].join("\n");
  }

  return [
    `Месячный отчёт (${range.startISO} - ${range.endISO})`,
    `Доход: ${formatAmount(stats.income, lang)}`,
    `Расход: ${formatAmount(stats.expense, lang)}`,
    `Итог: ${formatAmount(stats.net, lang)}`,
    `Записей: ${stats.count}`
  ].join("\n");
}

function buildRecordReminderText(lang, period) {
  if (lang === "uz") {
    if (period === "noon") return "Eslatma: tushgacha bo'lgan xarajat va kirimlarni yozib qo'ying.";
    return "Eslatma: kun oxirigacha barcha xarajat va kirimlarni yozing.";
  }

  if (period === "noon") return "Напоминание: запиши расходы и доходы до обеда.";
  return "Напоминание: к вечеру запиши все расходы и доходы за день.";
}

function buildDebtAlertText(lang, debtInfo) {
  const hasAlerts = debtInfo.overdue.length || debtInfo.soon.length;
  if (!hasAlerts) return "";

  const topOverdue = debtInfo.overdue.slice(0, 3);
  const topSoon = debtInfo.soon.slice(0, 3);

  if (lang === "uz") {
    const lines = [
      "Qarz eslatmasi",
      `Muddati o'tgan: ${debtInfo.overdue.length}`,
      `Yaqin 3 kun: ${debtInfo.soon.length}`
    ];
    topOverdue.forEach((item) => {
      lines.push(`- ${item.title || "Qarz"}: ${formatAmount(item.remaining, lang)} (${Math.abs(item.diff)} kun oldin)`);
    });
    topSoon.forEach((item) => {
      lines.push(`- ${item.title || "Qarz"}: ${formatAmount(item.remaining, lang)} (${item.diff} kun qoldi)`);
    });
    return lines.join("\n");
  }

  const lines = [
    "Напоминание по долгам",
    `Просрочено: ${debtInfo.overdue.length}`,
    `Срок до 3 дней: ${debtInfo.soon.length}`
  ];
  topOverdue.forEach((item) => {
    lines.push(`- ${item.title || "Долг"}: ${formatAmount(item.remaining, lang)} (${Math.abs(item.diff)} дн. назад)`);
  });
  topSoon.forEach((item) => {
    lines.push(`- ${item.title || "Долг"}: ${formatAmount(item.remaining, lang)} (через ${item.diff} дн.)`);
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
    await sendTelegramMessage(afterChatId, buildTelegramWelcomeText(lang), token);
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

