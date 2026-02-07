import { useEffect, useRef, useState } from "react";
import { onSiteToast } from "../lib/siteToast";

export default function SiteToastStack() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    const timers = timersRef.current;

    const removeToast = (id) => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    };

    const unsubscribe = onSiteToast((toast) => {
      const item = {
        id: toast.id,
        message: toast.message,
        variant: toast.variant || "info",
        duration: toast.duration || 3200
      };
      setToasts((prev) => [...prev, item].slice(-4));
      const timeoutId = setTimeout(() => removeToast(item.id), item.duration);
      timers.set(item.id, timeoutId);
    });

    return () => {
      unsubscribe();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="site-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`site-toast site-toast--${toast.variant}`} role="status">
          <span className="site-toast-message">{toast.message}</span>
          <button
            type="button"
            className="site-toast-close"
            onClick={() => {
              const timer = timersRef.current.get(toast.id);
              if (timer) {
                clearTimeout(timer);
                timersRef.current.delete(toast.id);
              }
              setToasts((prev) => prev.filter((item) => item.id !== toast.id));
            }}
            aria-label="Close"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
