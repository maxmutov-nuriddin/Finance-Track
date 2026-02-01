const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const TZ = "Asia/Tashkent";

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
