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
import { enableNotifications, getNotificationStatus } from "../lib/notifications";
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
  const [salaryDayOfMonth, setSalaryDayOfMonth] = useState("");
  const [targetSavingsMode, setTargetSavingsMode] = useState("goal_based");
  const [fixedMonthlySavings, setFixedMonthlySavings] = useState("");
  const [activeGoalId, setActiveGoalId] = useState("");
  const [savedBudgetState, setSavedBudgetState] = useState({
    budgetMode: "auto",
    manualMonthlyBudget: "",
    salaryDayOfMonth: "",
    targetSavingsMode: "goal_based",
    fixedMonthlySavings: "",
    activeGoalId: ""
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [savedTelegramChatId, setSavedTelegramChatId] = useState("");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [allRemindersEnabled, setAllRemindersEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderPermission, setReminderPermission] = useState(getNotificationStatus());
  const [clearMessage, setClearMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState("budget");

  useEffect(() => {
    if (!user) return;
    const unsubSettings = watchSettings(user.uid, (data) => {
      const nextBudgetMode = data?.budgetMode || "auto";
      const nextManualMonthlyBudget = data?.manualMonthlyBudget ? String(data.manualMonthlyBudget) : "";
      const nextSalaryDay = data?.salaryDayOfMonth ? String(data.salaryDayOfMonth) : "";
      const nextTargetSavingsMode = data?.targetSavingsMode || "goal_based";
      const nextFixedMonthlySavings = data?.fixedMonthlySavings ? String(data.fixedMonthlySavings) : "";
      const nextActiveGoalId = data?.activeGoalId || "";

      setBudgetMode(nextBudgetMode);
      setManualMonthlyBudget(nextManualMonthlyBudget);
      setSalaryDayOfMonth(nextSalaryDay);
      setTargetSavingsMode(nextTargetSavingsMode);
      setFixedMonthlySavings(nextFixedMonthlySavings);
      setActiveGoalId(nextActiveGoalId);
      setSavedBudgetState({
        budgetMode: nextBudgetMode,
        manualMonthlyBudget: nextManualMonthlyBudget,
        salaryDayOfMonth: nextSalaryDay,
        targetSavingsMode: nextTargetSavingsMode,
        fixedMonthlySavings: nextFixedMonthlySavings,
        activeGoalId: nextActiveGoalId
      });
      setAllRemindersEnabled(Boolean(data?.remindersEnabled));
      const nextTelegramId = data?.telegramChatId ? String(data.telegramChatId) : "";
      setTelegramChatId(nextTelegramId);
      setSavedTelegramChatId(nextTelegramId);
    });
    const unsubGoals = watchGoals(user.uid, setGoals);
    return () => {
      unsubSettings();
      unsubGoals();
    };
  }, [user]);

  const isGoalCompleted = (goal) => {
    if (goal?.isCompleted || goal?.completedAt) return true;
    const saved = Number(goal?.currentAmount ?? goal?.savedAmount ?? 0);
    const target = Number(goal?.targetAmount ?? 0);
    if (!Number.isFinite(target) || target <= 0) return false;
    return saved >= target;
  };

  const activeGoalOptions = goals.filter((goal) => !isGoalCompleted(goal));

  useEffect(() => {
    if (!activeGoalId) return;
    const exists = activeGoalOptions.some((goal) => goal.id === activeGoalId);
    if (!exists) {
      setActiveGoalId("");
    }
  }, [activeGoalId, activeGoalOptions]);

  useEffect(() => {
    setReminderPermission(getNotificationStatus());
  }, [activeTab]);

  const normalizeNumberInput = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const number = Number(text);
    return Number.isFinite(number) ? String(number) : text;
  };

  const isBudgetSettingsChanged =
    budgetMode !== savedBudgetState.budgetMode ||
    normalizeNumberInput(manualMonthlyBudget) !== normalizeNumberInput(savedBudgetState.manualMonthlyBudget) ||
    normalizeNumberInput(salaryDayOfMonth) !== normalizeNumberInput(savedBudgetState.salaryDayOfMonth) ||
    targetSavingsMode !== savedBudgetState.targetSavingsMode ||
    normalizeNumberInput(fixedMonthlySavings) !== normalizeNumberInput(savedBudgetState.fixedMonthlySavings) ||
    activeGoalId !== savedBudgetState.activeGoalId;

  const handleSave = async () => {
    if (!user || !isBudgetSettingsChanged) return;
    const normalizedSalaryDay = Math.round(Number(salaryDayOfMonth || 0));
    const safeSalaryDay =
      Number.isFinite(normalizedSalaryDay) && normalizedSalaryDay >= 1 && normalizedSalaryDay <= 31
        ? normalizedSalaryDay
        : null;

    await saveSettings(user.uid, {
      budgetMode,
      manualMonthlyBudget: manualMonthlyBudget ? Number(manualMonthlyBudget) : null,
      salaryDayOfMonth: safeSalaryDay,
      targetSavingsMode,
      fixedMonthlySavings: fixedMonthlySavings ? Number(fixedMonthlySavings) : null,
      activeGoalId: activeGoalId || null
    });
    setSavedBudgetState({
      budgetMode,
      manualMonthlyBudget: manualMonthlyBudget ? String(Number(manualMonthlyBudget)) : "",
      salaryDayOfMonth: safeSalaryDay ? String(safeSalaryDay) : "",
      targetSavingsMode,
      fixedMonthlySavings: fixedMonthlySavings ? String(Number(fixedMonthlySavings)) : "",
      activeGoalId: activeGoalId || ""
    });
    setSavedMessage(t("saved"));
    setTimeout(() => setSavedMessage(""), 2000);
  };

  const showReminderMessage = (message) => {
    setReminderMessage(message);
    setTimeout(() => setReminderMessage(""), 2500);
  };

  const handleToggleAllReminders = async () => {
    if (!user || reminderBusy) return;
    setReminderBusy(true);
    try {
      if (allRemindersEnabled) {
        await saveSettings(user.uid, {
          remindersEnabled: false,
          debtReminderEnabled: false,
          telegramEnabled: false
        });
        showReminderMessage(t("allRemindersOff"));
        return;
      }

      const result = await enableNotifications(user.uid);
      const status = result.status === "enabled" ? "granted" : result.status;
      setReminderPermission(status);

      if (status !== "granted") {
        if (status === "unsupported") {
          showReminderMessage(t("allRemindersUnsupported"));
        } else if (status === "denied") {
          showReminderMessage(t("allRemindersDenied"));
        } else {
          showReminderMessage(t("saveFailed"));
        }
        return;
      }

      await saveSettings(user.uid, {
        remindersEnabled: true,
        debtReminderEnabled: true,
        telegramEnabled: Boolean(telegramChatId.trim())
      });
      showReminderMessage(t("allRemindersOn"));
    } catch (error) {
      showReminderMessage(`${t("saveFailed")}${error?.message ? `: ${error.message}` : ""}`);
    } finally {
      setReminderBusy(false);
    }
  };

  const handleSaveTelegramId = async () => {
    if (!user) return;
    if (telegramBusy) return;
    if (!isTelegramIdChanged) return;
    const value = telegramChatId.trim();

    if (!value) {
      await saveSettings(user.uid, { telegramChatId: null, telegramEnabled: false });
      setSavedTelegramChatId("");
      setTelegramMessage(t("telegramIdCleared"));
      setTimeout(() => setTelegramMessage(""), 2500);
      return;
    }

    if (!/^-?\d+$/.test(value)) {
      setTelegramMessage(t("telegramIdInvalid"));
      setTimeout(() => setTelegramMessage(""), 2500);
      return;
    }

    setTelegramBusy(true);
    try {
      await saveSettings(user.uid, {
        telegramChatId: value,
        telegramEnabled: true
      });
      setSavedTelegramChatId(value);

      const token = String(import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
      if (!token) {
        setTelegramMessage(t("telegramBotTokenMissing"));
        setTimeout(() => setTelegramMessage(""), 3000);
        return;
      }

      const welcomeText =
        lang === "uz"
          ? "Xush kelibsiz! Siz Finance Track botini muvaffaqiyatli uladingiz."
          : "Добро пожаловать! Вы успешно подключили бота Finance Track.";

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: value,
          text: welcomeText,
          disable_web_page_preview: true
        })
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        setTelegramMessage(t("telegramWelcomeSent"));
      } else {
        setTelegramMessage(t("telegramWelcomeFailed"));
      }
      setTimeout(() => setTelegramMessage(""), 3000);
    } catch {
      setTelegramMessage(t("telegramWelcomeFailed"));
      setTimeout(() => setTelegramMessage(""), 3000);
    } finally {
      setTelegramBusy(false);
    }
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

  const telegramConnected = Boolean(telegramChatId.trim());
  const telegramReportsEnabled = telegramConnected && allRemindersEnabled;
  const isTelegramIdChanged = telegramChatId.trim() !== savedTelegramChatId.trim();
  const permissionState =
    reminderPermission === "unsupported"
      ? "unsupported"
      : reminderPermission === "denied"
        ? "denied"
        : reminderPermission === "granted"
          ? "granted"
          : "default";
  const permissionLabel =
    permissionState === "unsupported"
      ? t("notificationPermissionUnsupported")
      : permissionState === "denied"
        ? t("notificationPermissionDenied")
        : permissionState === "granted"
          ? t("notificationPermissionGranted")
          : t("notificationPermissionDefault");
  const permissionIsGood = permissionState === "granted";

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
                  {activeGoalOptions.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              </div>
            </GlassCard>
          </div>

          <div className="settings-grid settings-grid-budget-secondary">
            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">📅 {t("salaryDayTitle")}</h2>
              </div>
              <p className="settings-card-hint">{t("salaryDayHelp")}</p>

              <div className="settings-input-wrapper">
                <GlassInput
                  placeholder={t("salaryDayPlaceholder")}
                  type="number"
                  min={1}
                  max={31}
                  value={salaryDayOfMonth}
                  onChange={(event) => setSalaryDayOfMonth(event.target.value)}
                />
              </div>
            </GlassCard>
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
                <GlassButton onClick={handleSave} disabled={!isBudgetSettingsChanged} className="settings-action-btn">
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
                <h2 className="settings-card-title">🤖 {t("telegramBotTitle")}</h2>
              </div>
              <p className="settings-card-hint">{t("telegramBotHelp")}</p>
              <div className="settings-status-grid">
                <div className={`settings-status-item ${telegramConnected ? "is-on" : "is-off"}`}>
                  <span className="settings-status-label">{t("telegramConnectionStatusTitle")}</span>
                  <span className="settings-status-value">
                    {telegramConnected ? t("telegramConnectionConnected") : t("telegramConnectionNotConnected")}
                  </span>
                </div>
                <div className={`settings-status-item ${telegramReportsEnabled ? "is-on" : "is-off"}`}>
                  <span className="settings-status-label">{t("telegramReportsStatusTitle")}</span>
                  <span className="settings-status-value">
                    {telegramReportsEnabled ? t("statusEnabled") : t("statusDisabled")}
                  </span>
                </div>
              </div>
              {!allRemindersEnabled && telegramConnected ? (
                <p className="settings-status-note">{t("telegramEnableHint")}</p>
              ) : null}
              <div className="settings-input-wrapper">
                <label className="filter-label">{t("telegramIdLabel")}</label>
                <GlassInput
                  placeholder={t("telegramIdPlaceholder")}
                  value={telegramChatId}
                  onChange={(event) => setTelegramChatId(event.target.value)}
                />
              </div>
              <div className="settings-actions">
                <GlassButton
                  onClick={handleSaveTelegramId}
                  disabled={telegramBusy || !isTelegramIdChanged}
                  className="settings-action-btn"
                >
                  {t("saveTelegramId")}
                </GlassButton>
              </div>
              {telegramMessage && <div className="settings-success" style={{ marginTop: 12 }}>{telegramMessage}</div>}
            </GlassCard>

            <GlassCard>
              <div className="settings-card-header">
                <h2 className="settings-card-title">🔔 {t("allRemindersTitle")}</h2>
              </div>
              <p className="settings-card-hint">{t("allRemindersHelp")}</p>
              <div className="settings-status-grid">
                <div className={`settings-status-item ${allRemindersEnabled ? "is-on" : "is-off"}`}>
                  <span className="settings-status-label">{t("allRemindersStatusTitle")}</span>
                  <span className="settings-status-value">
                    {allRemindersEnabled ? t("statusEnabled") : t("statusDisabled")}
                  </span>
                </div>
                <div className={`settings-status-item ${permissionIsGood ? "is-on" : "is-off"}`}>
                  <span className="settings-status-label">{t("notificationPermissionTitle")}</span>
                  <span className="settings-status-value">{permissionLabel}</span>
                </div>
              </div>

              <div className="settings-actions">
                <GlassButton
                  variant={allRemindersEnabled ? "ghost" : "secondary"}
                  onClick={handleToggleAllReminders}
                  disabled={reminderBusy}
                  className="settings-action-btn"
                >
                  {allRemindersEnabled ? t("allRemindersDisableBtn") : t("allRemindersEnableBtn")}
                </GlassButton>
                {reminderBusy ? (
                  <span className="inline-loader" role="status" aria-label={t("save")}>
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                ) : null}
              </div>
              <p className="settings-card-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                {reminderPermission === "unsupported"
                  ? t("allRemindersUnsupported")
                  : reminderPermission === "denied"
                    ? t("allRemindersDenied")
                    : allRemindersEnabled
                      ? t("allRemindersOn")
                      : t("allRemindersOff")}
              </p>
              {reminderMessage && <div className="settings-success" style={{ marginTop: 12 }}>{reminderMessage}</div>}
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
