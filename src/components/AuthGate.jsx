import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { storeUserProfile } from "../lib/store";
import { UserContext } from "../lib/user";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";

const mapAuthError = (err) => {
  const code = err?.code || "";
  if (code.includes("auth/invalid-email")) return "Неверный email.";
  if (code.includes("auth/missing-email")) return "Введите email.";
  if (code.includes("auth/missing-password")) return "Введите пароль.";
  if (code.includes("auth/wrong-password")) return "Неверный пароль.";
  if (code.includes("auth/user-not-found")) return "Пользователь не найден.";
  if (code.includes("auth/email-already-in-use")) return "Email уже используется.";
  if (code.includes("auth/weak-password")) return "Слишком простой пароль.";
  return "Ошибка входа. Проверьте данные.";
};

export default function AuthGate({ children }) {
  const navigate = useNavigate();
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
        navigate("/", { replace: true });
      }
    });
    return () => unsub();
  }, [navigate]);

  const value = useMemo(() => user, [user]);

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message || "Ошибка входа");
    }
  };

  const handleEmailSignIn = async () => {
    setError("");
    if (!email.trim()) {
      setError("Введите email.");
      return;
    }
    if (!password) {
      setError("Введите пароль.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(mapAuthError(err));
    }
  };

  const handleEmailRegister = async () => {
    setError("");
    if (!email.trim()) {
      setError("Введите email.");
      return;
    }
    if (!password) {
      setError("Введите пароль.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMode("login");
    } catch (err) {
      setError(mapAuthError(err));
    }
  };

  if (loading) {
    return (
      <div className="auth-shell">
        <GlassCard className="auth-card">Загрузка...</GlassCard>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="auth-shell">
        <GlassCard className="auth-card">
          <h1 className="auth-title">
            {mode === "login" ? "Вход в финансовый помощник" : "Регистрация"}
          </h1>
          <p className="muted">
            {mode === "login"
              ? "Войди через Google или по email."
              : "Создай аккаунт через Google или по email."}
          </p>
          <div className="stack" style={{ marginTop: 16 }}>
            <GlassButton onClick={handleGoogle}>Войти через Google</GlassButton>
            <GlassInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <GlassInput
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {mode === "login" ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassButton onClick={handleEmailSignIn}>Войти</GlassButton>
              <GlassButton variant="secondary" onClick={() => setMode("register")}>
                Создать аккаунт
              </GlassButton>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassButton onClick={handleEmailRegister}>Зарегистрироваться</GlassButton>
              <GlassButton variant="secondary" onClick={() => setMode("login")}>
                У меня уже есть аккаунт
              </GlassButton>
            </div>
          )}
          {error && (
            <div className="alert alert-danger" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  return (
    <UserContext.Provider value={value}>
      <div>
        {children}
      </div>
    </UserContext.Provider>
  );
}
