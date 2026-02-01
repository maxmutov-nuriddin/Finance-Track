import { getToken } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, getMessagingIfSupported } from "./firebase";

export async function enableNotifications(uid) {
  if (!("Notification" in window)) {
    return { status: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { status: "denied" };
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) {
    return { status: "unsupported" };
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    return { status: "error" };
  }

  await setDoc(doc(db, `users/${uid}/fcmTokens/${token}`), {
    token,
    createdAt: serverTimestamp(),
    platform: navigator.userAgent
  });

  return { status: "enabled", token };
}

export function getNotificationStatus() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}
