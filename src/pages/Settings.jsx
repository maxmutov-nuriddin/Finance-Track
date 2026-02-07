import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import GlassInput from "../components/GlassInput";
import { useUser } from "../lib/user";
import { clearAllUserData, saveSettings, watchGoals, watchSettings } from "../lib/store";
import { formatAmount } from "../lib/format";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { auth } from "../lib/firebase";
import { db } from "../lib/firebase";
import { useI18n } from "../components/I18nProvider";
import { enableNotifications, getNotificationStatus } from "../lib/notifications";
import { Settings as SettingsIcon } from "lucide-react";
import { getMonthRangeFor } from "../lib/utils";
import { formatDateISO, getTzParts } from "../lib/timezone";
import { showSiteToast } from "../lib/siteToast";

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
  const [telegramReportBusy, setTelegramReportBusy] = useState(false);
  const [allRemindersEnabled, setAllRemindersEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderPermission, setReminderPermission] = useState(getNotificationStatus());
  const [clearMessage, setClearMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState("budget");
  const telegramBotHandle = "@mvfintrackbot";

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

  const showSavedMessage = (message, variant = "success", duration = 2000) => {
    if (!message) return;
    setSavedMessage(message);
    showSiteToast(message, variant, { duration });
    if (duration > 0) {
      setTimeout(() => setSavedMessage(""), duration);
    }
  };

  const showTelegramMessage = (message, variant = "info", duration = 3000) => {
    if (!message) return;
    setTelegramMessage(message);
    showSiteToast(message, variant, { duration });
    if (duration > 0) {
      setTimeout(() => setTelegramMessage(""), duration);
    }
  };

  const showClearMessage = (message, variant = "info", duration = 0) => {
    if (!message) return;
    setClearMessage(message);
    showSiteToast(message, variant, { duration: duration || 2200 });
    if (duration > 0) {
      setTimeout(() => setClearMessage(""), duration);
    }
  };

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
    showSavedMessage(t("saved"), "success", 2000);
  };

  const showReminderMessage = (message, variant = "info") => {
    setReminderMessage(message);
    showSiteToast(message, variant, { duration: 2500 });
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
        showReminderMessage(t("allRemindersOff"), "info");
        return;
      }

      const result = await enableNotifications(user.uid);
      const status = result.status === "enabled" ? "granted" : result.status;
      setReminderPermission(status);

      if (status !== "granted") {
        if (status === "unsupported") {
          showReminderMessage(t("allRemindersUnsupported"), "warning");
        } else if (status === "denied") {
          showReminderMessage(t("allRemindersDenied"), "warning");
        } else {
          showReminderMessage(t("saveFailed"), "error");
        }
        return;
      }

      await saveSettings(user.uid, {
        remindersEnabled: true,
        debtReminderEnabled: true,
        telegramEnabled: Boolean(telegramChatId.trim())
      });
      showReminderMessage(t("allRemindersOn"), "success");
    } catch (error) {
      showReminderMessage(`${t("saveFailed")}${error?.message ? `: ${error.message}` : ""}`, "error");
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
      showTelegramMessage(t("telegramIdCleared"), "info", 2500);
      return;
    }

    if (!/^-?\d+$/.test(value)) {
      showTelegramMessage(t("telegramIdInvalid"), "warning", 2500);
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
        showTelegramMessage(t("telegramBotTokenMissing"), "warning", 3200);
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
        showTelegramMessage(t("telegramWelcomeSent"), "success", 3000);
      } else {
        showTelegramMessage(t("telegramWelcomeFailed"), "error", 3200);
      }
    } catch {
      showTelegramMessage(t("telegramWelcomeFailed"), "error", 3200);
    } finally {
      setTelegramBusy(false);
    }
  };

  const formatReportAmount = (value) => {
    const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
    return Number(value || 0).toLocaleString(locale);
  };

  const buildManualTelegramReportText = ({
    todayISO,
    todayIncome,
    todayExpense,
    monthIncome,
    monthExpense,
    walletBalance,
    dailyLimit,
    myDebtsTotal,
    lentDebtsTotal
  }) => {
    if (lang === "uz") {
      return [
        `Qo'lda hisobot: ${todayISO}`,
        `Bugun kirim: ${formatReportAmount(todayIncome)}`,
        `Bugun chiqim: ${formatReportAmount(todayExpense)}`,
        `Oy kirimi: ${formatReportAmount(monthIncome)}`,
        `Oy chiqimi: ${formatReportAmount(monthExpense)}`,
        `Hamyon: ${formatReportAmount(walletBalance)}`,
        `Kunlik limit: ${formatReportAmount(dailyLimit)}`,
        `Mening qarzlarim: ${formatReportAmount(myDebtsTotal)}`,
        `Bergan qarzlarim: ${formatReportAmount(lentDebtsTotal)}`
      ].join("\n");
    }

    return [
      `Ручной отчёт: ${todayISO}`,
      `Доход сегодня: ${formatReportAmount(todayIncome)}`,
      `Расход сегодня: ${formatReportAmount(todayExpense)}`,
      `Доход за месяц: ${formatReportAmount(monthIncome)}`,
      `Расход за месяц: ${formatReportAmount(monthExpense)}`,
      `Кошелёк: ${formatReportAmount(walletBalance)}`,
      `Дневной лимит: ${formatReportAmount(dailyLimit)}`,
      `Мои долги: ${formatReportAmount(myDebtsTotal)}`,
      `Дал в долг: ${formatReportAmount(lentDebtsTotal)}`
    ].join("\n");
  };

  const handleSendTelegramReport = async () => {
    if (!user || telegramReportBusy) return;
    const chatId = telegramChatId.trim();
    if (!/^-?\d+$/.test(chatId)) {
      showTelegramMessage(t("telegramIdInvalid"), "warning", 3000);
      return;
    }

    const token = String(import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) {
      showTelegramMessage(t("telegramBotTokenMissing"), "warning", 3200);
      return;
    }

    setTelegramReportBusy(true);
    try {
      const now = new Date();
      const todayISO = formatDateISO(getTzParts(now));
      const monthRange = getMonthRangeFor(now);

      const [settingsSnap, txSnap, debtsSnap] = await Promise.all([
        getDoc(doc(db, `users/${user.uid}/settings/main`)),
        getDocs(
          query(
            collection(db, `users/${user.uid}/transactions`),
            orderBy("occurredAtISO", "desc"),
            limit(1500)
          )
        ),
        getDocs(
          query(
            collection(db, `users/${user.uid}/debts`),
            orderBy("createdAt", "desc"),
            limit(500)
          )
        )
      ]);

      const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
      const transactions = txSnap.docs.map((docSnap) => docSnap.data());
      const debts = debtsSnap.docs.map((docSnap) => docSnap.data());

      let todayIncome = 0;
      let todayExpense = 0;
      let monthIncome = 0;
      let monthExpense = 0;

      transactions.forEach((tx) => {
        const amount = Number(tx?.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        const dateISO = String(tx?.occurredAtISO || "").slice(0, 10);
        if (!dateISO) return;

        if (dateISO === todayISO) {
          if (tx?.type === "income") todayIncome += amount;
          if (tx?.type === "expense") todayExpense += amount;
        }

        if (dateISO >= monthRange.startISO && dateISO <= monthRange.endISO) {
          if (tx?.type === "income") monthIncome += amount;
          if (tx?.type === "expense") monthExpense += amount;
        }
      });

      let myDebtsTotal = 0;
      let lentDebtsTotal = 0;
      debts.forEach((debt) => {
        if (debt?.isClosed) return;
        const remaining = Number(debt?.remaining || 0);
        if (!Number.isFinite(remaining) || remaining <= 0) return;
        if (debt?.direction === "borrowed") myDebtsTotal += remaining;
        if (debt?.direction === "lent") lentDebtsTotal += remaining;
      });

      const reportText = buildManualTelegramReportText({
        todayISO,
        todayIncome,
        todayExpense,
        monthIncome,
        monthExpense,
        walletBalance: Number(settingsData?.walletBalance || 0),
        dailyLimit: Number(settingsData?.dailyLimitValue || 0),
        myDebtsTotal,
        lentDebtsTotal
      });

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reportText,
          disable_web_page_preview: true
        })
      });

      const payload = await response.json().catch(() => null);
      showTelegramMessage(response.ok && payload?.ok ? t("telegramReportSent") : t("telegramReportFailed"), response.ok && payload?.ok ? "success" : "error", 3000);
    } catch {
      showTelegramMessage(t("telegramReportFailed"), "error", 3000);
    } finally {
      setTelegramReportBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    const confirmed = window.confirm(t("clearConfirm"));
    if (!confirmed) return;
    if (clearing) return;
    setClearing(true);
    showClearMessage(t("clearing"), "info", 0);
    const timeoutMs = 15000;
    try {
      await Promise.race([
        clearAllUserData(user.uid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t("clearTimeout"))), timeoutMs)
        )
      ]);
      showClearMessage(t("cleared"), "success", 2000);
    } catch (error) {
      showClearMessage(`${t("clearFailed")}${error?.message ? `: ${error.message}` : ""}`, "error", 2600);
    }
    setClearing(false);
  };

  const telegramConnected = Boolean(telegramChatId.trim());
  const telegramReportsEnabled = telegramConnected && allRemindersEnabled;
  const isTelegramIdChanged = telegramChatId.trim() !== savedTelegramChatId.trim();
  const canSendTelegramReport = telegramConnected && !telegramBusy && !telegramReportBusy;
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
              <p className="settings-telegram-bot-line">
                {t("telegramBotAccount")}{" "}
                <a
                  className="settings-telegram-bot-link"
                  href="https://t.me/mvfintrackbot"
                  target="_blank"
                  rel="noreferrer"
                >
                  {telegramBotHandle}
                </a>
              </p>
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
                <GlassButton
                  variant="ghost"
                  onClick={handleSendTelegramReport}
                  disabled={!canSendTelegramReport}
                  className="settings-action-btn"
                >
                  {t("sendTelegramReport")}
                </GlassButton>
                {telegramReportBusy ? (
                  <span className="inline-loader" role="status" aria-label={t("sendTelegramReport")}>
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                ) : null}
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
