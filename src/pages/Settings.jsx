import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import GlassInput from "../components/GlassInput";
import { useUser } from "../lib/user";
import { clearAllUserData, saveSettings, watchGoals, watchSettings } from "../lib/store";
import { formatAmount } from "../lib/format";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { useI18n } from "../components/I18nProvider";
import { Settings as SettingsIcon } from "lucide-react";

const savingsModes = [
  { value: "goal_based", labelRu: "По цели", labelUz: "Maqsad bo'yicha" },
  { value: "fixed", labelRu: "Фикс", labelUz: "Fiks" }
];

export default function Settings() {
  const user = useUser();
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [goals, setGoals] = useState([]);

  const [budgetMode, setBudgetMode] = useState("auto");
  const [manualMonthlyBudget, setManualMonthlyBudget] = useState("");
  const [targetSavingsMode, setTargetSavingsMode] = useState("goal_based");
  const [fixedMonthlySavings, setFixedMonthlySavings] = useState("");
  const [activeGoalId, setActiveGoalId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState("budget");

  useEffect(() => {
    if (!user) return;
    const unsubSettings = watchSettings(user.uid, (data) => {
      setBudgetMode(data?.budgetMode || "auto");
      setManualMonthlyBudget(data?.manualMonthlyBudget ? String(data.manualMonthlyBudget) : "");
      setTargetSavingsMode(data?.targetSavingsMode || "goal_based");
      setFixedMonthlySavings(data?.fixedMonthlySavings ? String(data.fixedMonthlySavings) : "");
      setActiveGoalId(data?.activeGoalId || "");
    });
    const unsubGoals = watchGoals(user.uid, setGoals);
    return () => {
      unsubSettings();
      unsubGoals();
    };
  }, [user]);

  const handleSave = async () => {
    await saveSettings(user.uid, {
      budgetMode,
      manualMonthlyBudget: manualMonthlyBudget ? Number(manualMonthlyBudget) : null,
      targetSavingsMode,
      fixedMonthlySavings: fixedMonthlySavings ? Number(fixedMonthlySavings) : null,
      activeGoalId: activeGoalId || null
    });
    setSavedMessage(t("saved"));
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const handleClearAll = async () => {
    if (!user) return;
    const confirmed = window.confirm(t("clearConfirm"));
    if (!confirmed) return;
    if (clearing) return;
    setClearing(true);
    setClearMessage(t("clearing"));
    const timeoutMs = 15000;
    try {
      await Promise.race([
        clearAllUserData(user.uid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t("clearTimeout"))), timeoutMs)
        )
      ]);
      setClearMessage(t("cleared"));
    } catch (error) {
      setClearMessage(`${t("clearFailed")}${error?.message ? `: ${error.message}` : ""}`);
    }
    setClearing(false);
    setTimeout(() => setClearMessage(""), 2000);
  };

  return (
    <div className="settings-container">
      {clearing && (
        <div className="blocking-overlay" aria-live="polite" aria-busy="true">
          <div className="loading-spinner" role="status" aria-label={t("clearing")} />
        </div>
      )}

      <div className="settings-header">
        <div>
          <h1 className="settings-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <SettingsIcon size={28} strokeWidth={2.5} /> {t("settingsTitle")}
          </h1>
          <p className="settings-subtitle">{t("settingsHelp")}</p>
        </div>
      </div>

      {!clearing && clearMessage && <div className="toast" style={{ marginBottom: 16 }}>{clearMessage}</div>}

      <div className="settings-tabs-container">
        <button
          className={`settings-tab-btn ${activeTab === "budget" ? "active" : ""}`}
          onClick={() => setActiveTab("budget")}
        >
          ⚙️ {t("settingsTabBudget")}
        </button>
        <button
          className={`settings-tab-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          👤 {t("settingsTabAccount")}
        </button>
      </div>

      {activeTab === "budget" ? (
        <div className="settings-content budget-tab">
          <div className="settings-grid">
            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">💰 {t("budgetMode")}</h2>
              </div>
              <p className="settings-card-hint">{t("budgetModeHelp")}</p>

              <div className="settings-mode-buttons">
                <GlassButton
                  variant={budgetMode === "auto" ? "secondary" : "ghost"}
                  onClick={() => setBudgetMode("auto")}
                  className="mode-btn"
                >
                  AUTO
                </GlassButton>
                <GlassButton
                  variant={budgetMode === "manual" ? "secondary" : "ghost"}
                  onClick={() => setBudgetMode("manual")}
                  className="mode-btn"
                >
                  MANUAL
                </GlassButton>
              </div>

              {budgetMode === "manual" && (
                <div className="settings-input-wrapper">
                  <GlassInput
                    placeholder={t("monthlyBudget")}
                    type="number"
                    value={manualMonthlyBudget}
                    onChange={(event) => setManualMonthlyBudget(event.target.value)}
                  />
                  {manualMonthlyBudget && (
                    <div className="settings-preview">
                      {formatAmount(manualMonthlyBudget)}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">🎯 {t("activeGoal")}</h2>
              </div>
              <p className="settings-card-hint">{t("activeGoalHelp")}</p>

              <div className="settings-input-wrapper">
                <select
                  value={activeGoalId}
                  onChange={(event) => setActiveGoalId(event.target.value)}
                  className="settings-select"
                >
                  <option value="">{t("chooseGoal")}</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              </div>
            </GlassCard>
          </div>

          <div className="settings-grid">
            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">🏦 {t("savingsTitle")}</h2>
              </div>

              <div className="settings-mode-buttons">
                {savingsModes.map((mode) => (
                  <GlassButton
                    key={mode.value}
                    variant={targetSavingsMode === mode.value ? "secondary" : "ghost"}
                    onClick={() => setTargetSavingsMode(mode.value)}
                    className="mode-btn"
                  >
                    {lang === "uz" ? mode.labelUz : mode.labelRu}
                  </GlassButton>
                ))}
              </div>

              {targetSavingsMode === "fixed" && (
                <div className="settings-input-wrapper">
                  <GlassInput
                    placeholder={t("fixedMonthlyPlaceholder")}
                    type="number"
                    value={fixedMonthlySavings}
                    onChange={(event) => setFixedMonthlySavings(event.target.value)}
                  />
                  {fixedMonthlySavings && (
                    <div className="settings-preview">
                      {formatAmount(fixedMonthlySavings)}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">💾 {t("saveChanges")}</h2>
              </div>
              <p className="settings-card-hint">{t("saveHelp")}</p>

              <div className="settings-actions">
                <GlassButton onClick={handleSave} className="settings-action-btn">
                  {t("save")}
                </GlassButton>
                {savedMessage && <div className="settings-success">{savedMessage}</div>}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : (
        <div className="settings-content account-tab">
          <div className="settings-grid">
            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">👤 {t("account")}</h2>
              </div>
              <p className="settings-card-hint">{t("logout")}</p>

              <GlassButton
                variant="ghost"
                onClick={() => signOut(auth).then(() => navigate("/", { replace: true }))}
                className="settings-action-btn danger"
              >
                {t("logout")}
              </GlassButton>
            </GlassCard>

            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">🌐 {t("language")}</h2>
              </div>
              <p className="settings-card-hint">{t("languageHelp")}</p>

              <div className="settings-lang-switch">
                <GlassButton
                  variant={lang === "ru" ? "secondary" : "ghost"}
                  onClick={() => setLang("ru")}
                  className="lang-btn"
                >
                  🇷🇺 Русский
                </GlassButton>
                <GlassButton
                  variant={lang === "uz" ? "secondary" : "ghost"}
                  onClick={() => setLang("uz")}
                  className="lang-btn"
                >
                  🇺🇿 O'zbek
                </GlassButton>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">🗑️ {t("clearAll")}</h2>
              </div>
              <p className="settings-card-hint danger-hint">{t("clearAllHelp")}</p>

              <div className="settings-actions">
                <GlassButton
                  variant="ghost"
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="settings-action-btn danger"
                >
                  {t("clearAll")}
                </GlassButton>
                {clearing ? (
                  <span className="inline-loader" role="status" aria-label={t("clearing")}>
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                ) : null}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
