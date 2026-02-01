/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBygK1XYkwL8jQMfQD_02I7AmsHesdF9RU",
  authDomain: "finance-track-7fadf.firebaseapp.com",
  projectId: "finance-track-7fadf",
  storageBucket: "finance-track-7fadf.firebasestorage.app",
  messagingSenderId: "796953476389",
  appId: "1:796953476389:web:405a4ec16bfbc1c88d2ecc",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message", payload);

  const notificationTitle =
    payload.notification?.title || "Напоминание";

  const notificationOptions = {
    body: payload.notification?.body || "Проверь свои платежи",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});
