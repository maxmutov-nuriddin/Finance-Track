import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import QuickAddModal from "./components/QuickAddModal";
import Sidebar from "./components/Sidebar";
import SiteToastStack from "./components/SiteToastStack";
import { I18nProvider, useI18n } from "./components/I18nProvider";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import History from "./pages/History";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import "./App.css";

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="app-shell layout">
      <Sidebar activePath={location.pathname} onNavigate={navigate} />
      <div className="app-content">
        <SiteToastStack />
        <header className="app-header">
          <div className="brand">
            <div className="brand-title">Finance Track</div>
            <div className="brand-sub">{t("appSubtitle")}</div>
          </div>
          <QuickAddModal />
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
