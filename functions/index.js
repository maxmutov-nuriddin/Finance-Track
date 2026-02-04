const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const TZ = "Asia/Tashkent";
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

exports.notifyUpcomingPayments = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TZ,
    region: "asia-northeast1"
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

    if (paymentsSnap.empty) {
      return;
    }

    const tasks = [];

    for (const doc of paymentsSnap.docs) {
      const payment = doc.data();
      if (payment.lastNotifiedAtISO === todayISO) {
        continue;
      }

      const userRef = doc.ref.parent.parent;
      if (!userRef) {
        continue;
      }

      const tokensSnap = await userRef.collection("fcmTokens").get();
      const tokens = tokensSnap.docs.map((tokenDoc) => tokenDoc.id);
      if (!tokens.length) {
        continue;
      }

      const message = {
        notification: {
          title: "Напоминание о платеже",
          body: `Через 3 дня платеж: ${payment.title} — ${payment.amount}`
        },
        tokens
      };

      tasks.push(
        messaging.sendEachForMulticast(message).then(async (response) => {
          const batch = db.batch();
          response.responses.forEach((res, index) => {
            if (!res.success) {
              const tokenRef = userRef.collection("fcmTokens").doc(tokens[index]);
              batch.delete(tokenRef);
            }
          });
          batch.update(doc.ref, { lastNotifiedAtISO: todayISO });
          await batch.commit();
        })
      );
    }

    await Promise.all(tasks);
  }
);

exports.notifySalaryDay = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TZ,
    region: "asia-northeast1"
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();
    const todayParts = getDateParts(new Date(), TZ);
    const todayISO = formatDateISO(todayParts);
    const tomorrowParts = addDays(todayParts, 1);

    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) return;

    const tasks = [];

    for (const userDoc of usersSnap.docs) {
      const userRef = userDoc.ref;
      const settingsRef = userRef.collection("settings").doc("main");
      const settingsSnap = await settingsRef.get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};
      if (settings?.salaryReminderLastISO === todayISO) {
        continue;
      }

      const txSnap = await userRef
        .collection("transactions")
        .orderBy("occurredAtISO", "desc")
        .limit(200)
        .get();
      const transactions = txSnap.docs.map((doc) => doc.data());
      const salaryDay = detectSalaryDay(transactions);
      if (!salaryDay) {
        continue;
      }

      const monthDays = daysInMonth(tomorrowParts.year, tomorrowParts.month);
      const salaryDayThisMonth = Math.min(salaryDay, monthDays);
      if (tomorrowParts.day !== salaryDayThisMonth) {
        continue;
      }

      const tokensSnap = await userRef.collection("fcmTokens").get();
      const tokens = tokensSnap.docs.map((doc) => doc.id);
      if (!tokens.length) {
        continue;
      }

      const lang = settings?.language === "uz" ? "uz" : "ru";
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

      const message = { notification, tokens };
      tasks.push(
        messaging.sendEachForMulticast(message).then(async (response) => {
          const batch = db.batch();
          response.responses.forEach((res, index) => {
            if (!res.success) {
              const tokenRef = userRef.collection("fcmTokens").doc(tokens[index]);
              batch.delete(tokenRef);
            }
          });
          batch.set(settingsRef, { salaryReminderLastISO: todayISO }, { merge: true });
          await batch.commit();
        })
      );
    }

    await Promise.all(tasks);
  }
);
