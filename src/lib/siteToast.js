const SITE_TOAST_EVENT = "finance-track:site-toast";

let toastCounter = 0;

function nextToastId() {
  toastCounter += 1;
  return `${Date.now()}-${toastCounter}`;
}

export function showSiteToast(message, variant = "info", options = {}) {
  if (!message || typeof window === "undefined") return;

  const duration = Number(options?.duration);
  const payload = {
    id: nextToastId(),
    message: String(message),
    variant: variant || "info",
    duration: Number.isFinite(duration) && duration > 0 ? duration : 3200
  };

  window.dispatchEvent(new CustomEvent(SITE_TOAST_EVENT, { detail: payload }));
}

export function onSiteToast(listener) {
  if (typeof window === "undefined") return () => {};

  const handler = (event) => {
    const detail = event?.detail;
    if (!detail?.message) return;
    listener(detail);
  };

  window.addEventListener(SITE_TOAST_EVENT, handler);
  return () => window.removeEventListener(SITE_TOAST_EVENT, handler);
}

