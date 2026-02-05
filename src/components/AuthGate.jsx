import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { storeUserProfile } from "../lib/store";
import { UserContext } from "../lib/user";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { t as translate } from "../lib/i18n";

const mapAuthError = (err, t) => {
  const code = err?.code || "";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");

  useEffect(() => {
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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapAuthError(err, t));
    }
  };

  const handleEmailSignIn = async () => {
    setError("");
    if (!email.trim()) {
      setError(t("authMissingEmail"));
      return;
    }
    if (!password) {
      setError(t("authMissingPassword"));
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(mapAuthError(err, t));
    }
  };

  const handleEmailRegister = async () => {
    setError("");
    if (!email.trim()) {
      setError(t("authMissingEmail"));
      return;
    }
    if (!password) {
      setError(t("authMissingPassword"));
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMode("login");
    } catch (err) {
      setError(mapAuthError(err, t));
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
            <h1 className="auth-title">
              {mode === "login" ? "🔐 Finance Track" : "✨ Finance Track"}
            </h1>
            <p className="auth-subtitle">
              {mode === "login" ? t("authLoginHelp") : t("authRegisterHelp")}
            </p>
          </div>

          <div className="auth-social">
            <GlassButton 
              onClick={handleGoogle}
              className="auth-google-btn"
            >
              🔑 {t("signInGoogle")}
            </GlassButton>
          </div>

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
