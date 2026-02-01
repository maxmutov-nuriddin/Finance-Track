import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import { dedupById, filterByOccurredAtISO, getPeriodRange } from "./utils";

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

export function addPayment(uid, payload) {
  return addDoc(collection(db, `users/${uid}/payments`), {
    ...payload,
    amount: Math.round(Number(payload.amount || 0)),
    recurrence: payload.recurrence || "oneTime",
    createdAt: serverTimestamp()
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
