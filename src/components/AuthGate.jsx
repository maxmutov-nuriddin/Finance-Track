import { useEffect, useMemo, useState } from "react";
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { storeUserProfile } from "../lib/store";
import { UserContext } from "../lib/user";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { t as translate } from "../lib/i18n";
import { Sparkles, ShieldCheck, Clock3 } from "lucide-react";

function isEmbeddedInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "").toLowerCase();
  const markers = [
    "telegram",
    "instagram",
    "fban",
    "fbav",
    "line/",
    "micromessenger",
    "; wv",
    " wv)"
  ];
  return markers.some((marker) => ua.includes(marker));
}

const mapAuthError = (err, t) => {
  const code = err?.code || "";
  const message = String(err?.message || "").toLowerCase();
  if (message.includes("disallowed_useragent")) return t("authDisallowedUserAgent");
  if (code.includes("auth/operation-not-allowed")) return t("authGoogleDisabled");
  if (code.includes("auth/unauthorized-domain")) return t("authUnauthorizedDomain");
  if (code.includes("auth/popup-closed-by-user")) return t("authPopupClosed");
  if (code.includes("auth/popup-blocked")) return t("authPopupBlocked");
  if (code.includes("auth/network-request-failed")) return t("authNetworkError");
  if (code.includes("auth/missing-initial-state")) return t("authStorageBlocked");
  if (code.includes("auth/web-storage-unsupported")) return t("authStorageBlocked");
  if (message.includes("missing initial state")) return t("authStorageBlocked");
  if (code.includes("auth/invalid-email")) return t("authInvalidEmail");
  if (code.includes("auth/missing-email")) return t("authMissingEmail");
  if (code.includes("auth/missing-password")) return t("authMissingPassword");
  if (code.includes("auth/wrong-password")) return t("authWrongPassword");
  if (code.includes("auth/user-not-found")) return t("authUserNotFound");
  if (code.includes("auth/email-already-in-use")) return t("authEmailInUse");
  if (code.includes("auth/weak-password")) return t("authWeakPassword");
  return t("authGenericError");
};

export default function AuthGate({ children }) {
  const t = (key, vars) => translate("ru", key, vars);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const inAppBrowser = useMemo(() => isEmbeddedInAppBrowser(), []);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      setError(mapAuthError(err, t));
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        await storeUserProfile(nextUser.uid, {
          email: nextUser.email || "",
          name: nextUser.displayName || "",
          lastLoginAt: new Date().toISOString()
        });
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => user, [user]);

  const handleGoogle = async () => {
    setError("");
    if (inAppBrowser) {
      setError(t("authDisallowedUserAgent"));
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = String(err?.code || "");
      if (
        code.includes("auth/popup-blocked") ||
        code.includes("auth/cancelled-popup-request") ||
        code.includes("auth/operation-not-supported-in-this-environment")
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setError(mapAuthError(redirectErr, t));
          return;
        }
      }
      setError(mapAuthError(err, t));
    }
  };

  const handleOpenInBrowser = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    const telegramOpenLink = window?.Telegram?.WebApp?.openLink;
    if (typeof telegramOpenLink === "function") {
      telegramOpenLink(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      }
    } catch {
      // ignore clipboard issues in restricted webviews
    }
  };

  if (loading) {
    return (
      <div className="auth-shell auth-loading">
        <div className="loading-spinner" role="status" aria-label={t("authLoading")} />
      </div>
    );
  }

  if (!value) {
    return (
      <div className="auth-shell">
        <GlassCard className="auth-card">
          <div className="auth-header">
            <div className="auth-badge">
              <Sparkles size={14} />
              <span>Добро пожаловать</span>
            </div>
            <h1 className="auth-title">
              <span className="auth-title-main">Finance Track</span>
            </h1>
            <p className="auth-subtitle">{t("authLoginHelp")}</p>
            <div className="auth-benefits">
              <div className="auth-benefit">
                <ShieldCheck size={14} />
                <span>Защищенный вход</span>
              </div>
              <div className="auth-benefit">
                <Clock3 size={14} />
                <span>Вход за 10 секунд</span>
              </div>
            </div>
          </div>

          <div className="auth-social">
            <GlassButton onClick={handleGoogle} className="auth-google-btn">
              <span className="auth-google-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.08 3.56-5.16 3.56-8.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.12-6.72-4.96H1.27v3.12A12 12 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29A7.22 7.22 0 0 1 4.9 12c0-.8.14-1.58.38-2.29V6.59H1.27A12 12 0 0 0 0 12c0 1.94.46 3.78 1.27 5.41l4.01-3.12z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.35.61 4.6 1.82l3.45-3.45C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.59l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77z"
                  />
                </svg>
              </span>
              <span>{t("signInGoogle")}</span>
            </GlassButton>
          </div>

          {inAppBrowser && (
            <div className="auth-inline-note">
              <div className="auth-inline-note-text">{t("authDisallowedUserAgent")}</div>
              <div className="auth-inline-actions">
                <GlassButton variant="ghost" onClick={handleOpenInBrowser} className="auth-inline-btn">
                  {t("authOpenInBrowser")}
                </GlassButton>
                {linkCopied && <span className="auth-inline-copied">{t("authLinkCopied")}</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger auth-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  return (
    <UserContext.Provider value={value}>
      <div>{children}</div>
    </UserContext.Provider>
  );
}
