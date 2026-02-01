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
    try {
      await clearAllUserData(user.uid);
      setClearMessage(t("cleared"));
    } catch (error) {
      setClearMessage(t("clearFailed"));
    }
    setClearing(false);
    setTimeout(() => setClearMessage(""), 2000);
  };

  return (
    <div className="stack">
      <div>
        <div className="card-title">{t("settingsTitle")}</div>
        <div className="helper-text">{t("settingsHelp")}</div>
      </div>

      {clearMessage && <div className="toast">{clearMessage}</div>}

      <div className="row settings-tabs">
        <GlassButton
          className="settings-tab"
          variant={activeTab === "budget" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("budget")}
        >
          {t("settingsTabBudget")}
        </GlassButton>
        <GlassButton
          className="settings-tab"
          variant={activeTab === "account" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("account")}
        >
          {t("settingsTabAccount")}
        </GlassButton>
      </div>

      {activeTab === "budget" ? (
        <>
          <div className="grid-2">
            <GlassCard>
              <div className="card-title">{t("budgetMode")}</div>
              <div className="helper-text">{t("budgetModeHelp")}</div>
              <div className="row" style={{ marginTop: 10 }}>
                <GlassButton
                  variant={budgetMode === "auto" ? "secondary" : "ghost"}
                  onClick={() => setBudgetMode("auto")}
                >
                  AUTO
                </GlassButton>
                <GlassButton
                  variant={budgetMode === "manual" ? "secondary" : "ghost"}
                  onClick={() => setBudgetMode("manual")}
                >
                  MANUAL
                </GlassButton>
              </div>
              {budgetMode === "manual" && (
                <div style={{ marginTop: 12 }}>
                  <GlassInput
                    placeholder={t("monthlyBudget")}
                    type="number"
                    value={manualMonthlyBudget}
                    onChange={(event) => setManualMonthlyBudget(event.target.value)}
                  />
                  {manualMonthlyBudget && (
                    <div className="helper-text" style={{ marginTop: 6 }}>
                      {formatAmount(manualMonthlyBudget)}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="card-title">{t("activeGoal")}</div>
              <div className="helper-text">{t("activeGoalHelp")}</div>
              <div style={{ marginTop: 12 }}>
                <select
                  value={activeGoalId}
                  onChange={(event) => setActiveGoalId(event.target.value)}
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

          <div className="grid-2">
            <GlassCard>
              <div className="card-title">{t("savingsTitle")}</div>
              <div className="row" style={{ marginTop: 10 }}>
                {savingsModes.map((mode) => (
                  <GlassButton
                    key={mode.value}
                    variant={targetSavingsMode === mode.value ? "secondary" : "ghost"}
                    onClick={() => setTargetSavingsMode(mode.value)}
                  >
                    {lang === "uz" ? mode.labelUz : mode.labelRu}
                  </GlassButton>
                ))}
              </div>
              {targetSavingsMode === "fixed" && (
                <div style={{ marginTop: 12 }}>
                  <GlassInput
                    placeholder={t("fixedMonthlyPlaceholder")}
                    type="number"
                    value={fixedMonthlySavings}
                    onChange={(event) => setFixedMonthlySavings(event.target.value)}
                  />
                  {fixedMonthlySavings && (
                    <div className="helper-text" style={{ marginTop: 6 }}>
                      {formatAmount(fixedMonthlySavings)}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="card-title">{t("saveChanges")}</div>
              <div className="helper-text">{t("saveHelp")}</div>
              <div className="row" style={{ marginTop: 12 }}>
                <GlassButton onClick={handleSave}>{t("save")}</GlassButton>
                {savedMessage && <span className="toast">{savedMessage}</span>}
              </div>
            </GlassCard>
          </div>
        </>
      ) : (
        <div className="grid-2">
          <GlassCard>
            <div className="card-title">{t("account")}</div>
            <div className="helper-text">{t("logout")}</div>
            <GlassButton
              variant="ghost"
              onClick={() => signOut(auth).then(() => navigate("/", { replace: true }))}
              style={{ marginTop: 12 }}
            >
              {t("logout")}
            </GlassButton>
          </GlassCard>

          <GlassCard>
            <div className="card-title">{t("language")}</div>
            <div className="helper-text">{t("languageHelp")}</div>
            <div className="lang-switch" style={{ marginTop: 10 }}>
              <GlassButton
                variant={lang === "ru" ? "secondary" : "ghost"}
                onClick={() => setLang("ru")}
              >
                Русский
              </GlassButton>
              <GlassButton
                variant={lang === "uz" ? "secondary" : "ghost"}
                onClick={() => setLang("uz")}
              >
                O'zbek
              </GlassButton>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="card-title">{t("clearAll")}</div>
            <div className="helper-text">{t("clearAllHelp")}</div>
            <div className="row" style={{ marginTop: 12 }}>
          <GlassButton variant="ghost" onClick={handleClearAll} disabled={clearing}>
            {t("clearAll")}
          </GlassButton>
              {clearMessage && <span className="toast">{clearMessage}</span>}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
