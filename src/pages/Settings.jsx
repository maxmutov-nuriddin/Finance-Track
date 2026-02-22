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
const APP_SITE_URL = String(import.meta.env.VITE_APP_SITE_URL || "https://finance-track-7fadf.web.app").trim();
const TELEGRAM_ID_HELP_BOT = "@Get_myidrobot";
const SALARY_WORDS = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];
const BORROW_DEBT_WORDS = ["взял", "взяла", "занял", "заняла", "borrow", "qarz ol", "одолжил у"];
const COLLECT_DEBT_WORDS = ["забрал", "забрала", "вернули", "возврат", "collect", "undird", "qaytarib old"];
const LEND_DEBT_WORDS = ["дал в долг", "дала в долг", "одолжил", "одолжила", "lend", "loaned", "qarz ber"];

function toDateOnlyISO(date) {
  return formatDateISO(getTzParts(date));
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function previousWeekRange(refDate) {
  const date = new Date(refDate.getTime());
  const day = date.getDay(); // 0=Sun, 1=Mon
  const daysFromMonday = (day + 6) % 7;
  const thisWeekMonday = addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -daysFromMonday);
  const prevWeekMonday = addDays(thisWeekMonday, -7);
  const prevWeekSunday = addDays(thisWeekMonday, -1);
  return {
    startISO: toDateOnlyISO(prevWeekMonday),
    endISO: toDateOnlyISO(prevWeekSunday)
  };
}

function previousMonthRange(refDate) {
  const parts = getTzParts(refDate);
  const year = parts.month === 1 ? parts.year - 1 : parts.year;
  const month = parts.month === 1 ? 12 : parts.month - 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startISO: toDateOnlyISO(start),
    endISO: toDateOnlyISO(end)
  };
}

function shouldIncludeIncomeForMoneyFlow(tx) {
  if (tx?.type !== "income") return false;
  const amount = Number(tx?.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return false;

  if (tx?.meta?.kind === "debt") {
    return tx?.meta?.mode === "borrow";
  }

  if (tx?.category === "debt") {
    const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
    const isCollect = COLLECT_DEBT_WORDS.some((word) => text.includes(word));
    const isBorrow = BORROW_DEBT_WORDS.some((word) => text.includes(word));
    return isBorrow && !isCollect;
  }

  if (tx?.meta?.kind === "transfer") return false;

  const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
  return tx?.incomePeriod === "monthly" || SALARY_WORDS.some((word) => text.includes(word));
}

function shouldIncludeExpenseForMoneyFlow(tx) {
  if (tx?.type !== "expense") return false;
  const amount = Number(tx?.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (tx?.meta?.kind === "transfer") return false;
  if (tx?.meta?.kind === "debt" && (tx?.meta?.mode === "lend" || tx?.meta?.mode === "collect")) return false;

  if (tx?.category === "debt") {
    const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
    if (LEND_DEBT_WORDS.some((word) => text.includes(word))) return false;
  }

  return true;
}

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
          ? [
              "🎉 Finance Track ulandi!",
              "Hisobotlar va eslatmalar endi shu chatga keladi.",
              "",
              `🌐 Sayt: ${APP_SITE_URL}`,
              "🤖 Bot: @mvfintrackbot",
              `🆔 ID olish: ${TELEGRAM_ID_HELP_BOT} (/start yozing)`,
              "",
              "Keyingi qadamlar:",
              "1) Saytga kiring.",
              "2) Sozlamalar -> Telegram hisobotlar bo'limini oching.",
              "3) Telegram ID ni saqlang va eslatmalarni yoqing.",
              "4) «Hisobot yuborish» tugmasi bilan tekshiring."
            ].join("\n")
          : [
              "🎉 Finance Track подключен!",
              "Отчёты и напоминания теперь будут приходить в этот чат.",
              "",
              `🌐 Сайт: ${APP_SITE_URL}`,
              "🤖 Бот: @mvfintrackbot",
              `🆔 Где взять ID: ${TELEGRAM_ID_HELP_BOT} (напиши /start)`,
              "",
              "Что делать дальше:",
              "1) Войди на сайт.",
              "2) Открой Настройки -> Telegram отчёты.",
              "3) Сохрани Telegram ID и включи напоминания.",
              "4) Нажми «Отправить отчёт» для проверки."
            ].join("\n");

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

  const formatSignedReportAmount = (value) => {
    const num = Number(value || 0);
    const absText = formatReportAmount(Math.abs(num));
    if (num > 0) return `+${absText}`;
    if (num < 0) return `-${absText}`;
    return absText;
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
    const todayNet = Number(todayIncome || 0) - Number(todayExpense || 0);
    const monthNet = Number(monthIncome || 0) - Number(monthExpense || 0);

    if (lang === "uz") {
      return [
        `📘 Qo'lda hisobot · ${todayISO}`,
        "━━━━━━━━━━━━",
        `💵 Bugungi kirim: ${formatReportAmount(todayIncome)}`,
        `💸 Bugungi chiqim: ${formatReportAmount(todayExpense)}`,
        `⚖️ Bugungi natija: ${formatSignedReportAmount(todayNet)}`,
        "",
        "📅 Joriy oy",
        `• Kirim: ${formatReportAmount(monthIncome)}`,
        `• Chiqim: ${formatReportAmount(monthExpense)}`,
        `• Balans: ${formatSignedReportAmount(monthNet)}`,
        "",
        `👛 Hamyon: ${formatReportAmount(walletBalance)}`,
        `🎯 Kunlik limit: ${formatReportAmount(dailyLimit)}`,
        `🤝 Mening qarzlarim: ${formatReportAmount(myDebtsTotal)}`,
        `🫱 Bergan qarzlarim: ${formatReportAmount(lentDebtsTotal)}`
      ].join("\n");
    }

    return [
      `📘 Ручной отчёт · ${todayISO}`,
      "━━━━━━━━━━━━",
      `💵 Доход сегодня: ${formatReportAmount(todayIncome)}`,
      `💸 Расход сегодня: ${formatReportAmount(todayExpense)}`,
      `⚖️ Итог сегодня: ${formatSignedReportAmount(todayNet)}`,
      "",
      "📅 Текущий месяц",
      `• Доход: ${formatReportAmount(monthIncome)}`,
      `• Расход: ${formatReportAmount(monthExpense)}`,
      `• Баланс: ${formatSignedReportAmount(monthNet)}`,
      "",
      `👛 Кошелёк: ${formatReportAmount(walletBalance)}`,
      `🎯 Дневной лимит: ${formatReportAmount(dailyLimit)}`,
      `🤝 Мои долги: ${formatReportAmount(myDebtsTotal)}`,
      `🫱 Дал в долг: ${formatReportAmount(lentDebtsTotal)}`
    ].join("\n");
  };

  const buildMorningTelegramReportText = ({
    todayISO,
    todayExpense,
    monthIncome,
    monthExpense,
    walletBalance,
    dailyLimit,
    myDebtsTotal
  }) => {
    const monthNet = Number(monthIncome || 0) - Number(monthExpense || 0);
    const dailyRemaining = Number(dailyLimit || 0) - Number(todayExpense || 0);
    if (lang === "uz") {
      return [
        `🌅 Xayrli tong! ${todayISO}`,
        "━━━━━━━━━━━━",
        `👛 Hamyon: ${formatReportAmount(walletBalance)}`,
        `🎯 Kunlik limit: ${formatReportAmount(dailyLimit)}`,
        `💸 Bugun sarflangan: ${formatReportAmount(todayExpense)}`,
        `⚖️ Limit qoldig'i: ${formatSignedReportAmount(dailyRemaining)}`,
        "",
        "📅 Joriy oy",
        `• Kirim: ${formatReportAmount(monthIncome)}`,
        `• Chiqim: ${formatReportAmount(monthExpense)}`,
        `• Balans: ${formatSignedReportAmount(monthNet)}`,
        `🤝 Mening qarzlarim: ${formatReportAmount(myDebtsTotal)}`
      ].join("\n");
    }

    return [
      `🌅 Доброе утро! ${todayISO}`,
      "━━━━━━━━━━━━",
      `👛 Кошелёк: ${formatReportAmount(walletBalance)}`,
      `🎯 Дневной лимит: ${formatReportAmount(dailyLimit)}`,
      `💸 Потрачено сегодня: ${formatReportAmount(todayExpense)}`,
      `⚖️ Остаток лимита: ${formatSignedReportAmount(dailyRemaining)}`,
      "",
      "📅 Текущий месяц",
      `• Доход: ${formatReportAmount(monthIncome)}`,
      `• Расход: ${formatReportAmount(monthExpense)}`,
      `• Баланс: ${formatSignedReportAmount(monthNet)}`,
      `🤝 Мои долги: ${formatReportAmount(myDebtsTotal)}`
    ].join("\n");
  };

  const buildWeeklyTelegramReportText = ({ rangeStartISO, rangeEndISO, weekIncome, weekExpense, weekCount }) => {
    const weekNet = Number(weekIncome || 0) - Number(weekExpense || 0);
    if (lang === "uz") {
      return [
        "📗 Haftalik hisobot",
        `📅 ${rangeStartISO} - ${rangeEndISO}`,
        "━━━━━━━━━━━━",
        `💵 Kirim: ${formatReportAmount(weekIncome)}`,
        `💸 Chiqim: ${formatReportAmount(weekExpense)}`,
        `⚖️ Natija: ${formatSignedReportAmount(weekNet)}`,
        `🧾 Yozuvlar: ${weekCount}`
      ].join("\n");
    }

    return [
      "📗 Недельный отчёт",
      `📅 ${rangeStartISO} - ${rangeEndISO}`,
      "━━━━━━━━━━━━",
      `💵 Доход: ${formatReportAmount(weekIncome)}`,
      `💸 Расход: ${formatReportAmount(weekExpense)}`,
      `⚖️ Итог: ${formatSignedReportAmount(weekNet)}`,
      `🧾 Записей: ${weekCount}`
    ].join("\n");
  };

  const buildMonthlyTelegramReportText = ({ rangeStartISO, rangeEndISO, monthIncome, monthExpense, monthCount }) => {
    const monthNet = Number(monthIncome || 0) - Number(monthExpense || 0);
    if (lang === "uz") {
      return [
        "📙 Oylik hisobot",
        `📅 ${rangeStartISO} - ${rangeEndISO}`,
        "━━━━━━━━━━━━",
        `💵 Kirim: ${formatReportAmount(monthIncome)}`,
        `💸 Chiqim: ${formatReportAmount(monthExpense)}`,
        `⚖️ Natija: ${formatSignedReportAmount(monthNet)}`,
        `🧾 Yozuvlar: ${monthCount}`
      ].join("\n");
    }

    return [
      "📙 Месячный отчёт",
      `📅 ${rangeStartISO} - ${rangeEndISO}`,
      "━━━━━━━━━━━━",
      `💵 Доход: ${formatReportAmount(monthIncome)}`,
      `💸 Расход: ${formatReportAmount(monthExpense)}`,
      `⚖️ Итог: ${formatSignedReportAmount(monthNet)}`,
      `🧾 Записей: ${monthCount}`
    ].join("\n");
  };

  const buildTelegramReminderText = (period) => {
    if (lang === "uz") {
      if (period === "noon") {
        return ["⏰ Eslatma", "Tushgacha bo'lgan kirim va chiqimlarni yozib qo'ying."].join("\n");
      }
      return ["⏰ Eslatma", "Kechqurun barcha kirim va chiqimlarni yozishni unutmang."].join("\n");
    }

    if (period === "noon") {
      return ["⏰ Напоминание", "Запиши доходы и расходы до обеда."].join("\n");
    }
    return ["⏰ Напоминание", "К вечеру запиши все расходы и доходы за день."].join("\n");
  };

  const sendTelegramText = async (chatId, token, text) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    const payload = await response.json().catch(() => null);
    return Boolean(response.ok && payload?.ok);
  };

  const collectTelegramReportData = async () => {
    if (!user) return null;
    const now = new Date();
    const todayISO = toDateOnlyISO(now);
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
        if (shouldIncludeIncomeForMoneyFlow(tx)) todayIncome += amount;
        if (shouldIncludeExpenseForMoneyFlow(tx)) todayExpense += amount;
      }

      if (dateISO >= monthRange.startISO && dateISO <= monthRange.endISO) {
        if (shouldIncludeIncomeForMoneyFlow(tx)) monthIncome += amount;
        if (shouldIncludeExpenseForMoneyFlow(tx)) monthExpense += amount;
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

    return {
      now,
      todayISO,
      monthRange,
      settingsData,
      transactions,
      debts,
      todayIncome,
      todayExpense,
      monthIncome,
      monthExpense,
      myDebtsTotal,
      lentDebtsTotal,
      walletBalance: Number(settingsData?.walletBalance || 0),
      dailyLimit: Number(settingsData?.dailyLimitValue || 0)
    };
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
      const report = await collectTelegramReportData();
      if (!report) {
        showTelegramMessage(t("telegramReportFailed"), "error", 3000);
        return;
      }

      const reportText = buildManualTelegramReportText({
        todayISO: report.todayISO,
        todayIncome: report.todayIncome,
        todayExpense: report.todayExpense,
        monthIncome: report.monthIncome,
        monthExpense: report.monthExpense,
        walletBalance: report.walletBalance,
        dailyLimit: report.dailyLimit,
        myDebtsTotal: report.myDebtsTotal,
        lentDebtsTotal: report.lentDebtsTotal
      });

      const sent = await sendTelegramText(chatId, token, reportText);
      showTelegramMessage(sent ? t("telegramReportSent") : t("telegramReportFailed"), sent ? "success" : "error", 3000);
    } catch {
      showTelegramMessage(t("telegramReportFailed"), "error", 3000);
    } finally {
      setTelegramReportBusy(false);
    }
  };

  // Local fallback scheduler for Telegram without Firebase Functions (works while site is open).
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!user || !allRemindersEnabled) return;

    const chatId = telegramChatId.trim();
    const token = String(import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "").trim();
    if (!/^-?\d+$/.test(chatId) || !token) return;

    const storagePrefix = `finance_track_local_tg_scheduler_v1:${user.uid}`;
    let running = false;

    const wasSent = (type, key) => localStorage.getItem(`${storagePrefix}:${type}:${key}`) === "1";
    const markSent = (type, key) => localStorage.setItem(`${storagePrefix}:${type}:${key}`, "1");

    const isDueWindow = (parts, hour, minute = 0, windowMinutes = 20) => {
      const nowMinutes = parts.hour * 60 + parts.minute;
      const targetMinutes = hour * 60 + minute;
      return nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + windowMinutes;
    };

    const summarizeRange = (transactions, startISO, endISO) => {
      let income = 0;
      let expense = 0;
      let count = 0;
      (transactions || []).forEach((tx) => {
        const iso = String(tx?.occurredAtISO || "").slice(0, 10);
        if (!iso || iso < startISO || iso > endISO) return;
        const amount = Number(tx?.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        count += 1;
        if (shouldIncludeIncomeForMoneyFlow(tx)) income += amount;
        if (shouldIncludeExpenseForMoneyFlow(tx)) expense += amount;
      });
      return { income, expense, count };
    };

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const now = new Date();
        const parts = getTzParts(now);
        const todayISO = toDateOnlyISO(now);
        const weekKey = previousWeekRange(now).startISO;
        const monthKeyValue = previousMonthRange(now).startISO;

        const dueMorning = isDueWindow(parts, 6) && !wasSent("morning", todayISO);
        const dueNoon = isDueWindow(parts, 12) && !wasSent("noon", todayISO);
        const dueEvening = isDueWindow(parts, 18) && !wasSent("evening", todayISO);
        const dueDaily = isDueWindow(parts, 22) && !wasSent("daily", todayISO);
        const dueWeekly = parts.day === 1 && isDueWindow(parts, 0, 0, 30) && !wasSent("weekly", weekKey);
        const dueMonthly = parts.day === 1 && isDueWindow(parts, 0, 0, 30) && !wasSent("monthly", monthKeyValue);

        const needReportData = dueMorning || dueDaily || dueWeekly || dueMonthly;
        const report = needReportData ? await collectTelegramReportData() : null;

        if (dueMorning && report) {
          const text = buildMorningTelegramReportText({
            todayISO: report.todayISO,
            todayExpense: report.todayExpense,
            monthIncome: report.monthIncome,
            monthExpense: report.monthExpense,
            walletBalance: report.walletBalance,
            dailyLimit: report.dailyLimit,
            myDebtsTotal: report.myDebtsTotal
          });
          if (await sendTelegramText(chatId, token, text)) markSent("morning", todayISO);
        }

        if (dueNoon) {
          if (await sendTelegramText(chatId, token, buildTelegramReminderText("noon"))) markSent("noon", todayISO);
        }

        if (dueEvening) {
          if (await sendTelegramText(chatId, token, buildTelegramReminderText("evening"))) markSent("evening", todayISO);
        }

        if (dueDaily && report) {
          const text = buildManualTelegramReportText({
            todayISO: report.todayISO,
            todayIncome: report.todayIncome,
            todayExpense: report.todayExpense,
            monthIncome: report.monthIncome,
            monthExpense: report.monthExpense,
            walletBalance: report.walletBalance,
            dailyLimit: report.dailyLimit,
            myDebtsTotal: report.myDebtsTotal,
            lentDebtsTotal: report.lentDebtsTotal
          });
          if (await sendTelegramText(chatId, token, text)) markSent("daily", todayISO);
        }

        if (dueWeekly && report) {
          const range = previousWeekRange(now);
          const weekStats = summarizeRange(report.transactions, range.startISO, range.endISO);
          const text = buildWeeklyTelegramReportText({
            rangeStartISO: range.startISO,
            rangeEndISO: range.endISO,
            weekIncome: weekStats.income,
            weekExpense: weekStats.expense,
            weekCount: weekStats.count
          });
          if (await sendTelegramText(chatId, token, text)) markSent("weekly", weekKey);
        }

        if (dueMonthly && report) {
          const range = previousMonthRange(now);
          const monthStats = summarizeRange(report.transactions, range.startISO, range.endISO);
          const text = buildMonthlyTelegramReportText({
            rangeStartISO: range.startISO,
            rangeEndISO: range.endISO,
            monthIncome: monthStats.income,
            monthExpense: monthStats.expense,
            monthCount: monthStats.count
          });
          if (await sendTelegramText(chatId, token, text)) markSent("monthly", monthKeyValue);
        }
      } catch (error) {
        console.error("local telegram scheduler failed", error);
      } finally {
        running = false;
      }
    };

    tick();
    const timer = setInterval(tick, 60 * 1000);
    return () => clearInterval(timer);
  }, [user, allRemindersEnabled, telegramChatId, lang]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
  const profileName =
    String(user?.displayName || "").trim() ||
    String(user?.email || "").split("@")[0] ||
    "User";
  const profileEmail = String(user?.email || "").trim() || "no-email";
  const initials =
    profileName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";
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
        <div className="sidebar-user-card settings-user-card" title={profileEmail}>
          <div className="sidebar-user-main">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={profileName}
                  className="sidebar-user-photo"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{profileName}</div>
              <div className="sidebar-user-email">{profileEmail}</div>
            </div>
          </div>
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
              <p className="settings-status-note" style={{ marginBottom: 10 }}>
                {t("telegramLocalModeNote")}
              </p>
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
