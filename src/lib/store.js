import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  setDoc,
  writeBatch,
  increment
} from "firebase/firestore";
import { db } from "./firebase";
import { dedupById, filterByOccurredAtISO, getPeriodRange } from "./utils";
import { formatISOWithOffset, getTzParts, nowInTashkent } from "./timezone";

export function addTransaction(uid, payload) {
  return addDoc(collection(db, `users/${uid}/transactions`), {
    ...payload,
    amount: Math.round(Number(payload.amount || 0)),
    createdAt: serverTimestamp()
  });
}

export function watchTransactions(uid, callback) {
  const ref = query(
    collection(db, `users/${uid}/transactions`),
    orderBy("occurredAt", "desc")
  );
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(dedupById(rows));
  });
}

export function deleteTransaction(uid, id) {
  return deleteDoc(doc(db, `users/${uid}/transactions/${id}`));
}

export function addGoal(uid, payload) {
  return addDoc(collection(db, `users/${uid}/goals`), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

export function watchGoals(uid, callback) {
  const ref = query(collection(db, `users/${uid}/goals`), orderBy("createdAt", "desc"));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(dedupById(rows));
  });
}

export function deleteGoal(uid, id) {
  return deleteDoc(doc(db, `users/${uid}/goals/${id}`));
}

export function deleteGoalWithRefund(uid, goalId, refundAmount = 0) {
  const batch = writeBatch(db);
  const goalRef = doc(db, `users/${uid}/goals/${goalId}`);
  if (refundAmount > 0) {
    const settingsRef = doc(db, `users/${uid}/settings/main`);
    batch.set(
      settingsRef,
      { walletBalance: increment(Math.round(Number(refundAmount || 0))) },
      { merge: true }
    );
  }
  batch.delete(goalRef);
  return batch.commit();
}

export function addPayment(uid, payload) {
  const nowParts = getTzParts(nowInTashkent());
  const fallbackDateISO = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`;
  const fallbackDateTimeISO = formatISOWithOffset(nowParts);
  return addDoc(collection(db, `users/${uid}/payments`), {
    ...payload,
    title: payload.title || "Платеж",
    payDateISO: payload.payDateISO || fallbackDateISO,
    payDateTimeISO: payload.payDateTimeISO || fallbackDateTimeISO,
    amount: Math.round(Number(payload.amount || 0)),
    recurrence: payload.recurrence || "oneTime",
    createdAt: serverTimestamp()
  });
}

export function addDebt(uid, payload) {
  return addDoc(collection(db, `users/${uid}/debts`), {
    ...payload,
    amount: Math.round(Number(payload.amount || 0)),
    remaining: Math.round(Number(payload.remaining || payload.amount || 0)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function watchDebts(uid, callback) {
  const ref = query(collection(db, `users/${uid}/debts`), orderBy("createdAt", "desc"));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(dedupById(rows));
  });
}

export function updateDebt(uid, id, payload) {
  return setDoc(doc(db, `users/${uid}/debts/${id}`), payload, { merge: true });
}

export function adjustWalletBalance(uid, delta) {
  return setDoc(
    doc(db, `users/${uid}/settings/main`),
    { walletBalance: increment(Math.round(Number(delta || 0))) },
    { merge: true }
  );
}

export function watchPayments(uid, callback) {
  const ref = query(collection(db, `users/${uid}/payments`), orderBy("payDateISO", "asc"));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    callback(dedupById(rows));
  });
}

export function deletePayment(uid, id) {
  return deleteDoc(doc(db, `users/${uid}/payments/${id}`));
}

export async function addGoalContribution(uid, goalId, amount, goalTitle = "") {
  const safeAmount = Math.round(Number(amount || 0));
  if (!safeAmount || safeAmount <= 0) return;
  const now = nowInTashkent();
  const occurredAtISO = formatISOWithOffset(getTzParts(now));
  const batch = writeBatch(db);
  const goalRef = doc(db, `users/${uid}/goals/${goalId}`);
  batch.set(
    goalRef,
    {
      currentAmount: increment(safeAmount),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  const txRef = doc(collection(db, `users/${uid}/transactions`));
  batch.set(txRef, {
    amount: safeAmount,
    createdAt: serverTimestamp(),
    occurredAt: now,
    occurredAtISO,
    category: "other",
    type: "expense",
    description: goalTitle ? `Накопление: ${goalTitle}` : "Накопление",
    raw: goalTitle ? `накопить ${safeAmount} ${goalTitle}` : `накопить ${safeAmount}`
  });
  await batch.commit();
}

export function completeGoal(uid, goalId) {
  const goalRef = doc(db, `users/${uid}/goals/${goalId}`);
  return setDoc(
    goalRef,
    {
      isCompleted: true,
      completedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function watchLast14Or30(uid, days, callback) {
  const range = getPeriodRange(days);
  const ref = query(
    collection(db, `users/${uid}/transactions`),
    orderBy("occurredAt", "desc")
  );
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const filtered = filterByOccurredAtISO(rows, range.start, range.end);
    callback(dedupById(filtered));
  });
}

export function storeUserProfile(uid, payload) {
  return setDoc(doc(db, `users/${uid}`), payload, { merge: true });
}

export function watchSettings(uid, callback) {
  const ref = doc(db, `users/${uid}/settings/main`);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function saveSettings(uid, payload) {
  return setDoc(doc(db, `users/${uid}/settings/main`), payload, { merge: true });
}

export async function clearAllUserData(uid) {
  const collections = ["transactions", "goals", "payments", "debts", "fcmTokens", "alerts"];

  const deleteCollection = async (name) => {
    const ref = collection(db, `users/${uid}/${name}`);
    while (true) {
      const snap = await getDocs(query(ref, limit(200)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  };

  for (const name of collections) {
    await deleteCollection(name);
  }

  const settingsRef = doc(db, `users/${uid}/settings/main`);
  const settingsBatch = writeBatch(db);
  settingsBatch.delete(settingsRef);
  settingsBatch.delete(doc(db, `users/${uid}`));
  await settingsBatch.commit();
}


