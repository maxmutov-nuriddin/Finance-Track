import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import QuickAddModal from "./components/QuickAddModal";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import SmartInputBar from "./components/SmartInputBar";
import SiteToastStack from "./components/SiteToastStack";
import { I18nProvider, useI18n } from "./components/I18nProvider";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import History from "./pages/History";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import "./App.css";
import "./App.meetai.css";

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [advancedRaw, setAdvancedRaw] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Theme: read from localStorage, default dark
  const [theme, setTheme] = useState(() => localStorage.getItem("ft-theme") || "dark");

  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
    document.body.classList.add("theme-meet");
    localStorage.setItem("ft-theme", theme);
  }, [theme]);

  const handleOpenAdvanced = (raw) => {
    setAdvancedRaw(raw || "");
    setAdvancedOpen(true);
  };

  return (
    <div className="app-shell app-shell--meet layout">
      <Sidebar activePath={location.pathname} onNavigate={navigate} />
      <div className="app-content">
        <SiteToastStack />
        <header className="app-header">
          <div className="app-header-actions">
            <div className="brand app-brand-mobile">
              <div className="app-brand-chip" aria-hidden="true">FT</div>
              <div className="app-brand-copy">
                <div className="brand-title">Finance Track</div>
                <div className="brand-sub">{t("appSubtitle")}</div>
              </div>
            </div>

            {/* Smart Input Bar — always visible */}
            <SmartInputBar onOpenAdvanced={handleOpenAdvanced} />

            {/* Advanced modal for debts, goals, transfers */}
            <QuickAddModal
              externalOpen={advancedOpen}
              externalRaw={advancedRaw}
              onExternalClose={() => { setAdvancedOpen(false); setAdvancedRaw(""); }}
            />

            {/* Theme toggle */}
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              aria-label="Переключить тему"
            >
              {theme === "dark"
                ? <Sun size={16} strokeWidth={2} />
                : <Moon size={16} strokeWidth={2} />
              }
            </button>
          </div>
        </header>
        <main className="app-main">
          <div className="page-wrap">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
        <MobileNav activePath={location.pathname} onNavigate={navigate} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </AuthGate>
  );
}
