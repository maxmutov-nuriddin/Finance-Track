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
  runTransaction,
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

export async function addTransfer(uid, payload) {
  const amount = Math.round(Number(payload?.amount || 0));
  if (!amount || amount <= 0) return;
  const direction = payload?.direction === "spend_to_wallet" ? "spend_to_wallet" : "wallet_to_spend";
  const settingsRef = doc(db, `users/${uid}/settings/main`);
  const txRef = doc(collection(db, `users/${uid}/transactions`));
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(settingsRef);
    const current = Number(snap.exists() ? snap.data()?.walletBalance || 0 : 0);
    const delta = direction === "wallet_to_spend" ? -amount : amount;
    if (direction === "wallet_to_spend" && current < amount) {
      throw new Error("wallet_insufficient");
    }
    const nextBalance = Math.max(0, current + delta);
    transaction.set(settingsRef, { walletBalance: nextBalance }, { merge: true });
    transaction.set(txRef, {
      amount,
      createdAt: serverTimestamp(),
      occurredAt: payload?.occurredAt || nowInTashkent(),
      occurredAtISO: payload?.occurredAtISO || formatISOWithOffset(getTzParts(nowInTashkent())),
      category: "carryover",
      type: direction === "wallet_to_spend" ? "income" : "expense",
      description: payload?.description || "Перевод",
      raw: payload?.raw || "",
      meta: { kind: "transfer", direction }
    });
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
    savedAmount: Math.round(Number(payload.currentAmount || payload.savedAmount || 0)),
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
  const change = Math.round(Number(delta || 0));
  if (!change) return Promise.resolve();
  const ref = doc(db, `users/${uid}/settings/main`);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = Number(snap.exists() ? snap.data()?.walletBalance || 0 : 0);
    const nextBalance = Math.max(0, current + change);
    transaction.set(ref, { walletBalance: nextBalance }, { merge: true });
  });
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
      savedAmount: increment(safeAmount),
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
    raw: goalTitle ? `накопить ${safeAmount} ${goalTitle}` : `накопить ${safeAmount}`,
    meta: { goalId, kind: "goal_contribution" }
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

export async function withdrawGoalAmount(uid, goalId, amount) {
  const safeAmount = Math.round(Number(amount || 0));
  if (!safeAmount || safeAmount <= 0) return;
  const goalRef = doc(db, `users/${uid}/goals/${goalId}`);
  const settingsRef = doc(db, `users/${uid}/settings/main`);
  return runTransaction(db, async (transaction) => {
    const goalSnap = await transaction.get(goalRef);
    if (!goalSnap.exists()) return;
    const data = goalSnap.data() || {};
    const current = Math.max(0, Number(data.currentAmount ?? data.savedAmount ?? 0));
    const withdraw = Math.min(current, safeAmount);
    if (withdraw <= 0) return;
    const nextAmount = current - withdraw;
    transaction.set(
      goalRef,
      { currentAmount: nextAmount, savedAmount: nextAmount, updatedAt: serverTimestamp() },
      { merge: true }
    );
    transaction.set(settingsRef, { walletBalance: increment(withdraw) }, { merge: true });
  });
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


