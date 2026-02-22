const VERSION = "v7";
const ICON_VERSION = "10";
const MANIFEST_VERSION = "8";
const STATIC_CACHE = `finance-track-static-${VERSION}`;
const STATIC_FALLBACKS = [
  "/",
  "/index.html",
  "/offline.html",
  `/manifest.webmanifest?v=${MANIFEST_VERSION}`,
  `/icon-48.png?v=${ICON_VERSION}`,
  `/icon-72.png?v=${ICON_VERSION}`,
  `/icon-96.png?v=${ICON_VERSION}`,
  `/icon-192.png?v=${ICON_VERSION}`,
  `/icon-512.png?v=${ICON_VERSION}`,
  `/icon-192-maskable.png?v=${ICON_VERSION}`,
  `/icon-512-maskable.png?v=${ICON_VERSION}`,
  `/apple-touch-icon.png?v=${ICON_VERSION}`
];
const STATIC_DESTINATIONS = new Set(["style", "script", "worker", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_FALLBACKS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("finance-track-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isNetworkOnlyRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__/") ||
    url.pathname === "/firebase-messaging-sw.js" ||
    url.pathname === "/sw.js"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match("/offline.html")) || Response.error();
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNetworkOnlyRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || !networkResponse.ok) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        });
      })
    );
  }
});
