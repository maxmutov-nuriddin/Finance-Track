import { useEffect, useMemo, useState } from "react";
import BudgetCard from "../components/BudgetCard";
import GlassCard from "../components/GlassCard";
import PaymentsOverview from "../components/PaymentsOverview";
import StatsCard from "../components/StatsCard";
import ExpenseCategoriesPie from "../components/ExpenseCategoriesPie";
import { useUser } from "../lib/user";
import {
  addGoalContribution,
  watchDebts,
  watchGoals,
  watchPayments,
  watchTransactions,
  watchSettings,
  saveSettings
} from "../lib/store";
import { addDaysInTz, addMonthsInTz, formatDateISO, getTzParts, makeTashkentDate, nowInTashkent } from "../lib/timezone";
import { useNavigate } from "react-router-dom";
import { computeBudgetStatus } from "../lib/budget";
import { filterByOccurredAtISO, getMonthKey, getMonthRange, getMonthRangeFor } from "../lib/utils";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarDays,
  CreditCard,
  Crosshair,
  HandCoins,
  Receipt,
  TrendingDown,
  Wallet as WalletIcon
} from "lucide-react";
import { computeStats } from "../lib/calcs";
import { formatAmount } from "../lib/format";
import { useI18n } from "../components/I18nProvider";
import ModalPortal from "../components/ModalPortal";
import GlassButton from "../components/GlassButton";
import {
  computeMandatoryMonthly,
  computeRecurringMonthlyFromTransactions,
  computeMonthExpense,
  computeMonthlyExpense,
  computeMonthlyIncome,
  computeRecommendedSpend,
  computeRequiredMonthlySavings,
  getActiveGoal
} from "../lib/budgetCalc";
import { showSiteToast } from "../lib/siteToast";

const SALARY_WORDS = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];
const BORROW_DEBT_WORDS = ["взял", "взяла", "занял", "заняла", "borrow", "qarz ol", "одолжил у"];
const COLLECT_DEBT_WORDS = ["забрал", "забрала", "вернули", "возврат", "collect", "undird", "qaytarib old"];
const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_LABEL_KEYS = {
  cafe: "categoryCafe",
  groceries: "categoryGroceries",
  food: "categoryFood",
  transport: "categoryTransport",
  clothes: "categoryClothes",
  beauty: "categoryBeauty",
  kids: "categoryKids",
  gifts: "categoryGifts",
  pets: "categoryPets",
  travel: "categoryTravel",
  home: "categoryHome",
  subscriptions: "categorySubscriptions",
  taxes: "categoryTaxes",
  entertainment: "categoryEntertainment",
  shopping: "categoryShopping",
  utilities: "categoryUtilities",
  health: "categoryHealth",
  education: "categoryEducation",
  personal: "categoryPersonal",
  credit: "categoryCredit",
  debt: "categoryDebt",
  rent: "categoryRent",
  carryover: "categoryCarryover"
};

function categoryLabel(category, t) {
  return t(CATEGORY_LABEL_KEYS[category] || "categoryOther");
}

function isoFromUnknownDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return formatDateISO(getTzParts(value));
  if (typeof value?.toDate === "function") return formatDateISO(getTzParts(value.toDate()));
  return "";
}

function startOfDay(date) {
  const parts = getTzParts(date);
  return makeTashkentDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0
  });
}

function endOfDay(date) {
  const parts = getTzParts(date);
  return makeTashkentDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 23,
    minute: 59,
    second: 59
  });
}

function dateDiffFromToday(dateISO, todayDate = new Date()) {
  if (!dateISO) return null;
  const [year, month, day] = String(dateISO)
    .slice(0, 10)
    .split("-")
    .map((value) => Number(value));
  if (!year || !month || !day) return null;
  const dueDate = makeTashkentDate({ year, month, day, hour: 0, minute: 0, second: 0 });
  const today = startOfDay(todayDate);
  return Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
}

function debtLastActivityISO(debt) {
  return (
    isoFromUnknownDate(debt?.updatedAt) ||
    isoFromUnknownDate(debt?.createdAt) ||
    String(debt?.createdDateISO || "").slice(0, 10)
  );
}

function shouldSkipDebtFlowForSpend(tx) {
  const mode = tx?.meta?.mode;
  return tx?.meta?.kind === "debt" && (mode === "lend" || mode === "collect");
}

function summarizeRange(transactions, startDate, endDate) {
  const inRange = (transactions || []).filter((tx) => {
    if (!tx?.occurredAtISO) return false;
    const time = new Date(tx.occurredAtISO).getTime();
    return time >= startDate.getTime() && time <= endDate.getTime();
  });

  const summary = {
    income: 0,
    expense: 0,
    net: 0,
    ops: inRange.length,
    topCategory: "",
    topCategoryAmount: 0
  };

  const categorySpend = new Map();
  inRange.forEach((tx) => {
    const amount = Number(tx?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;

    if (tx.type === "income") {
      summary.income += amount;
      return;
    }
    if (tx.type !== "expense") return;
    if (shouldSkipDebtFlowForSpend(tx)) return;

    summary.expense += amount;
    const key = tx.category || "other";
    categorySpend.set(key, (categorySpend.get(key) || 0) + amount);
  });

  for (const [category, amount] of categorySpend.entries()) {
    if (amount > summary.topCategoryAmount) {
      summary.topCategory = category;
      summary.topCategoryAmount = amount;
    }
  }

  summary.net = summary.income - summary.expense;
  return summary;
}

function buildExpenseSeries(transactions, range) {
  const days = range.days;
  const base = makeTashkentDate(getTzParts(range.end));
  const dates = Array.from({ length: days }).map((_, index) => {
    const parts = addDaysInTz(base, -days + 1 + index);
    return { iso: formatDateISO(parts), label: String(parts.day).padStart(2, "0") };
  });
  const map = new Map(dates.map((d) => [d.iso, 0]));
  transactions.forEach((item) => {
    if (!item.occurredAtISO) return;
    const dateKey = item.occurredAtISO.slice(0, 10);
    if (!map.has(dateKey)) return;
    if (item.type !== "expense") return;
    map.set(dateKey, map.get(dateKey) + Number(item.amount || 0));
  });
  return dates.map((item) => ({
    date: item.iso,
    label: item.label,
    value: map.get(item.iso) || 0
  }));
}

function buildExpenseSeriesForDays(transactions, endDate, days) {
  const base = makeTashkentDate(getTzParts(endDate));
  const dates = Array.from({ length: days }).map((_, index) => {
    const parts = addDaysInTz(base, -days + 1 + index);
    return { iso: formatDateISO(parts), label: String(parts.day).padStart(2, "0") };
  });
  const map = new Map(dates.map((d) => [d.iso, 0]));
  transactions.forEach((item) => {
    if (item.type !== "expense" || !item.occurredAtISO) return;
    const dateKey = item.occurredAtISO.slice(0, 10);
    if (!map.has(dateKey)) return;
    map.set(dateKey, map.get(dateKey) + Number(item.amount || 0));
  });
  return dates.map((item) => ({
    date: item.iso,
    label: item.label,
    value: map.get(item.iso) || 0
  }));
}

function buildExpenseSeriesByHour(transactions, nowDate) {
  const now = nowDate;
  const hours = Array.from({ length: 24 }).map((_, i) => {
    const d = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`,
      label: String(d.getHours()).padStart(2, "0")
    };
  });
  const map = new Map(hours.map((h) => [h.key, 0]));
  transactions.forEach((item) => {
    if (item.type !== "expense" || !item.occurredAtISO) return;
    const d = new Date(item.occurredAtISO);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    if (!map.has(key)) return;
    map.set(key, map.get(key) + Number(item.amount || 0));
  });
  return hours.map((h) => ({ date: h.key, label: h.label, value: map.get(h.key) || 0 }));
}

function buildExpenseSeriesByMonth(transactions, nowDate, lang = "ru") {
  const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const months = Array.from({ length: 6 }).map((_, i) => {
    const parts = addMonthsInTz(nowDate, -5 + i);
    const key = `${parts.year}-${String(parts.month).padStart(2, "0")}`;
    const label = formatter.format(new Date(parts.year, parts.month - 1, 1));
    return { key, label };
  });
  const map = new Map(months.map((m) => [m.key, 0]));
  transactions.forEach((item) => {
    if (item.type !== "expense" || !item.occurredAtISO) return;
    const d = new Date(item.occurredAtISO);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) return;
    map.set(key, map.get(key) + Number(item.amount || 0));
  });
  return months.map((m) => ({ date: m.key, label: m.label, value: map.get(m.key) || 0 }));
}

function pickBestDay(entries) {
  if (!entries?.length) return null;
  const stats = new Map();
  entries.forEach((entry) => {
    const existing = stats.get(entry.day) || { count: 0, last: null };
    existing.count += 1;
    if (!existing.last || entry.date > existing.last) {
      existing.last = entry.date;
    }
    stats.set(entry.day, existing);
  });

  let bestDay = null;
  let bestCount = -1;
  let bestLast = null;
  for (const [day, info] of stats.entries()) {
    if (info.count > bestCount) {
      bestDay = day;
      bestCount = info.count;
      bestLast = info.last;
      continue;
    }
    if (info.count === bestCount && info.last && bestLast && info.last > bestLast) {
      bestDay = day;
      bestLast = info.last;
    }
  }
  return bestDay;
}

function getSalaryDay(transactions, manualDayValue, nowDate = new Date()) {
  const manualDay = Math.round(Number(manualDayValue || 0));
  if (manualDay >= 1 && manualDay <= 31) return manualDay;

  const now = nowDate;
  const limit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const prevMonthParts = addMonthsInTz(nowDate, -1);
  const prevYear = prevMonthParts.year;
  const prevMonth = prevMonthParts.month;

  const prevMonthSalaryPool = [];
  const incomePool = [];
  const salaryPool = [];

  transactions.forEach((item) => {
    if (item?.type !== "income" || !item?.occurredAtISO) return;
    const date = new Date(item.occurredAtISO);
    const parts = getTzParts(date);
    const entry = { day: parts.day, date };
    const text = `${item.description || ""} ${item.raw || ""}`.toLowerCase();
    const isSalary = SALARY_WORDS.some((word) => text.includes(word));

    if (parts.year === prevYear && parts.month === prevMonth && isSalary) {
      prevMonthSalaryPool.push(entry);
    }

    if (date < limit) return;
    incomePool.push(entry);
    if (isSalary) {
      salaryPool.push(entry);
    }
  });

  const previousMonthDay = pickBestDay(prevMonthSalaryPool);
  if (previousMonthDay) return previousMonthDay;

  const pool = salaryPool.length >= 2 ? salaryPool : incomePool;
  return pickBestDay(pool);
}

function isDebtExpense(item) {
  const category = item?.category || "";
  const raw = (item?.raw || "").toLowerCase();
  return category === "credit" || category === "debt" || raw.includes("долг") || raw.includes("кредит");
}

function isGoalSavingExpense(item) {
  if (item?.meta?.kind === "goal_contribution") return true;
  const description = (item?.description || "").toLowerCase();
  const raw = (item?.raw || "").toLowerCase();
  const hasGoalKeyword = description.includes("накоп") || raw.includes("накоп");
  if (!hasGoalKeyword) return false;
  return !isDebtExpense(item);
}

function isSpecialExpense(item) {
  return isGoalSavingExpense(item) || isDebtExpense(item);
}

export default function Dashboard() {
  const user = useUser();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [walletNotice, setWalletNotice] = useState("");
  const [monthTick, setMonthTick] = useState(getMonthKey(new Date()));
  const [dayTick, setDayTick] = useState(() => formatDateISO(getTzParts(nowInTashkent())));
  const [carryoverModalOpen, setCarryoverModalOpen] = useState(false);
  const [chartRange, setChartRange] = useState("month");
  const debtReminderPermission =
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission;

  useEffect(() => {
    if (!user) return;
    const unsubGoals = watchGoals(user.uid, setGoals);
    const unsubDebts = watchDebts(user.uid, setDebts);
    const unsubPayments = watchPayments(user.uid, setPayments);
    const unsubAll = watchTransactions(user.uid, setAllTransactions);
    const unsubSettings = watchSettings(user.uid, setSettings);
    return () => {
      unsubGoals();
      unsubDebts();
      unsubPayments();
      unsubAll();
      unsubSettings();
    };
  }, [user]);

  useEffect(() => {
    if (!walletNotice) return;
    showSiteToast(walletNotice, "info", { duration: 3600 });
  }, [walletNotice]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextKey = getMonthKey(new Date());
      setMonthTick((prev) => (prev === nextKey ? prev : nextKey));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextDay = formatDateISO(getTzParts(nowInTashkent()));
      setDayTick((prev) => (prev === nextDay ? prev : nextDay));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const periodRange = useMemo(() => getMonthRange(), [allTransactions.length, monthTick]);
  const statsTransactions = useMemo(
    () => filterByOccurredAtISO(allTransactions, periodRange.start, periodRange.end),
    [allTransactions, periodRange]
  );
  const analysisStartDate = useMemo(() => {
    const monthStart = periodRange.start;
    let earliestSalary = null;
    statsTransactions.forEach((item) => {
      if (item?.type !== "income" || !item?.occurredAtISO) return;
      const text = `${item.description || ""} ${item.raw || ""}`.toLowerCase();
      const isSalary = SALARY_WORDS.some((word) => text.includes(word));
      if (!isSalary) return;
      const date = new Date(item.occurredAtISO);
      if (!earliestSalary || date < earliestSalary) {
        earliestSalary = date;
      }
    });
    if (earliestSalary) return earliestSalary;
    return monthStart;
  }, [statsTransactions, periodRange.start]);
  const analysisDaysPassed = useMemo(() => {
    const todayParts = getTzParts(nowInTashkent());
    const todayStart = makeTashkentDate({
      year: todayParts.year,
      month: todayParts.month,
      day: todayParts.day,
      hour: 0,
      minute: 0,
      second: 0
    });
    const startParts = getTzParts(analysisStartDate);
    const startDate = makeTashkentDate({
      year: startParts.year,
      month: startParts.month,
      day: startParts.day,
      hour: 0,
      minute: 0,
      second: 0
    });
    const diffDays = Math.floor((todayStart.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, diffDays);
  }, [analysisStartDate]);

  const stats = useMemo(() => computeStats(statsTransactions), [statsTransactions]);
  const periodDays = useMemo(() => {
    const now = nowInTashkent();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return new Date(year, month, 0).getDate();
  }, [monthTick]);
  const manualSalaryDay = Number(settings?.salaryDayOfMonth || 0);
  const salaryDay = useMemo(
    () => getSalaryDay(allTransactions, manualSalaryDay, nowInTashkent()),
    [allTransactions, manualSalaryDay, dayTick]
  );
  const daysUntilSalary = useMemo(() => {
    if (!salaryDay) return null;
    const todayParts = getTzParts(nowInTashkent());
    const todayStart = makeTashkentDate({
      year: todayParts.year,
      month: todayParts.month,
      day: todayParts.day,
      hour: 0,
      minute: 0,
      second: 0
    });
    const getMonthDays = (year, month) => new Date(year, month, 0).getDate();
    let targetYear = todayParts.year;
    let targetMonth = todayParts.month;
    let targetDay = Math.min(salaryDay, getMonthDays(targetYear, targetMonth));
    if (todayParts.day >= targetDay) {
      const next = addMonthsInTz(nowInTashkent(), 1);
      targetYear = next.year;
      targetMonth = next.month;
      targetDay = Math.min(salaryDay, getMonthDays(targetYear, targetMonth));
    }
    const targetDate = makeTashkentDate({
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour: 0,
      minute: 0,
      second: 0
    });
    const diff =
      Math.floor((targetDate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, diff);
  }, [salaryDay, dayTick]);
  const monthlyIncome = useMemo(
    () => computeMonthlyIncome(statsTransactions, periodDays),
    [statsTransactions, periodDays]
  );
  const monthlySalaryCardAmount = useMemo(() => {
    return statsTransactions.reduce((sum, tx) => {
      if (tx?.type !== "income") return sum;
      const amount = Number(tx?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) return sum;

      if (tx?.meta?.kind === "debt") {
        return tx?.meta?.mode === "borrow" ? sum + amount : sum;
      }

      if (tx?.category === "debt") {
        const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
        const isCollect = COLLECT_DEBT_WORDS.some((word) => text.includes(word));
        const isBorrow = BORROW_DEBT_WORDS.some((word) => text.includes(word));
        return isBorrow && !isCollect ? sum + amount : sum;
      }

      if (tx?.meta?.kind === "transfer") return sum;

      const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
      const isSalary = tx?.incomePeriod === "monthly" || SALARY_WORDS.some((word) => text.includes(word));
      return isSalary ? sum + amount : sum;
    }, 0);
  }, [statsTransactions]);
  const statsMoneyCard = useMemo(() => {
    const income = Math.max(0, Number(monthlySalaryCardAmount || 0));
    const expense = Number(stats?.expense || 0);
    return {
      ...stats,
      income,
      net: income - expense
    };
  }, [stats, monthlySalaryCardAmount]);
  const monthlyExpense = useMemo(
    () => computeMonthlyExpense(statsTransactions, periodDays),
    [statsTransactions, periodDays]
  );
  const monthlyMandatory = useMemo(() => {
    const fromPayments = computeMandatoryMonthly(payments, new Date());
    if (payments?.length) return fromPayments;
    return computeRecurringMonthlyFromTransactions(allTransactions, new Date());
  }, [payments, allTransactions]);
  const recurringPaidThisMonth = useMemo(
    () => computeRecurringMonthlyFromTransactions(allTransactions, new Date()),
    [allTransactions]
  );
  const mandatoryRemaining = useMemo(
    () => Math.max(0, Number(monthlyMandatory || 0) - Number(recurringPaidThisMonth || 0)),
    [monthlyMandatory, recurringPaidThisMonth]
  );

  const activeGoal = useMemo(() => getActiveGoal(goals, settings), [goals, settings]);
  const totalGoalsSaved = useMemo(
    () => goals.reduce((sum, goal) => sum + Number(goal.currentAmount || 0), 0),
    [goals]
  );
  const totalGoalsTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0),
    [goals]
  );
  const myDebtsCount = useMemo(
    () =>
      debts.filter((debt) => debt.direction === "borrowed" && !debt.isClosed && Number(debt.remaining || 0) > 0)
        .length,
    [debts]
  );
  const myDebtsTotal = useMemo(
    () =>
      debts.reduce((sum, debt) => {
        if (debt.direction !== "borrowed" || debt.isClosed) return sum;
        const remaining = Number(debt.remaining || 0);
        if (remaining <= 0) return sum;
        return sum + remaining;
      }, 0),
    [debts]
  );
  const lentDebtsCount = useMemo(
    () =>
      debts.filter((debt) => debt.direction === "lent" && !debt.isClosed && Number(debt.remaining || 0) > 0)
        .length,
    [debts]
  );
  const lentDebtsTotal = useMemo(
    () =>
      debts.reduce((sum, debt) => {
        if (debt.direction !== "lent" || debt.isClosed) return sum;
        const remaining = Number(debt.remaining || 0);
        if (remaining <= 0) return sum;
        return sum + remaining;
      }, 0),
    [debts]
  );

  const plannedMonthlySavings = useMemo(() => {
    return computeRequiredMonthlySavings(activeGoal, stats.net, settings);
  }, [activeGoal, settings, stats.net]);

  const budgetPlannedSavings = 0;

  const recommendedMaxSpend = useMemo(() => {
    return computeRecommendedSpend({
      monthlyIncome,
      monthlyMandatory,
      plannedMonthlySavings: budgetPlannedSavings,
      settings
    });
  }, [monthlyIncome, monthlyMandatory, settings]);

  const safeRecommendedSpend = useMemo(
    () => (recommendedMaxSpend < 0 ? 0 : recommendedMaxSpend || 0),
    [recommendedMaxSpend]
  );

  const planSpend = useMemo(() => {
    const value = monthlyIncome - monthlyMandatory - budgetPlannedSavings;
    return value < 0 ? 0 : value;
  }, [monthlyIncome, monthlyMandatory]);

  const plannedMonthlyNet = useMemo(() => {
    if (!Number.isFinite(safeRecommendedSpend)) return 0;
    return monthlyIncome - monthlyMandatory - safeRecommendedSpend;
  }, [monthlyIncome, monthlyMandatory, safeRecommendedSpend]);

  const currentMonthExpense = useMemo(
    () => computeMonthExpense(allTransactions),
    [allTransactions]
  );
  const currentMonthExpenseNonRecurring = useMemo(() => {
    const nowParts = getTzParts(new Date());
    const year = nowParts.year;
    const month = nowParts.month;
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      const parts = getTzParts(new Date(item.occurredAtISO));
      if (parts.year === year && parts.month === month) {
        return sum + Number(item.amount || 0);
      }
      return sum;
    }, 0);
  }, [allTransactions]);
  const currentMonthRegularExpenseNonRecurring = useMemo(() => {
    const nowParts = getTzParts(new Date());
    const year = nowParts.year;
    const month = nowParts.month;
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      if (isSpecialExpense(item)) return sum;
      const parts = getTzParts(new Date(item.occurredAtISO));
      if (parts.year === year && parts.month === month) {
        return sum + Number(item.amount || 0);
      }
      return sum;
    }, 0);
  }, [allTransactions]);
  const currentMonthGoalSavingsExpense = useMemo(() => {
    const nowParts = getTzParts(nowInTashkent());
    const year = nowParts.year;
    const month = nowParts.month;
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      if (!isGoalSavingExpense(item)) return sum;
      const parts = getTzParts(new Date(item.occurredAtISO));
      if (parts.year === year && parts.month === month) {
        return sum + Number(item.amount || 0);
      }
      return sum;
    }, 0);
  }, [allTransactions, dayTick]);

  const todayISO = useMemo(() => dayTick, [dayTick]);
  const todayExpense = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      const iso = item.occurredAtISO.slice(0, 10);
      if (iso !== todayISO) return sum;
      return sum + Number(item.amount || 0);
    }, 0);
  }, [allTransactions, todayISO]);

  const todaySpecialExpense = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      const iso = item.occurredAtISO.slice(0, 10);
      if (iso !== todayISO) return sum;
      if (isSpecialExpense(item)) {
        return sum + Number(item.amount || 0);
      }
      return sum;
    }, 0);
  }, [allTransactions, todayISO]);

  const todayRegularExpense = useMemo(() => {
    const regular = Number(todayExpense || 0) - Number(todaySpecialExpense || 0);
    return regular < 0 ? 0 : regular;
  }, [todayExpense, todaySpecialExpense]);

  const currentMonthExpenseBeforeToday = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      const parts = getTzParts(new Date(item.occurredAtISO));
      const itemMonthKey = getMonthKey(new Date(item.occurredAtISO));
      if (itemMonthKey !== getMonthKey(new Date())) return sum;
      const itemISO = formatDateISO(parts);
      if (itemISO >= todayISO) return sum;
      return sum + Number(item.amount || 0);
    }, 0);
  }, [allTransactions, todayISO]);
  const currentMonthExpenseBeforeTodayNonRecurring = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      if (item.isRecurring) return sum;
      const parts = getTzParts(new Date(item.occurredAtISO));
      const itemMonthKey = getMonthKey(new Date(item.occurredAtISO));
      if (itemMonthKey !== getMonthKey(new Date())) return sum;
      const itemISO = formatDateISO(parts);
      if (itemISO >= todayISO) return sum;
      return sum + Number(item.amount || 0);
    }, 0);
  }, [allTransactions, todayISO]);

  const remainingDaysInMonth = useMemo(() => {
    const todayParts = getTzParts(nowInTashkent());
    const todayStart = makeTashkentDate({
      year: todayParts.year,
      month: todayParts.month,
      day: todayParts.day,
      hour: 0,
      minute: 0,
      second: 0
    });
    const endDate = makeTashkentDate(getTzParts(periodRange.end));
    const diffDays = Math.ceil((endDate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(1, diffDays);
  }, [periodRange.end, dayTick]);

  const dailyHorizonDays = useMemo(() => {
    if (Number.isFinite(daysUntilSalary) && daysUntilSalary > 0) {
      return Math.max(1, daysUntilSalary);
    }
    return remainingDaysInMonth;
  }, [daysUntilSalary, remainingDaysInMonth]);
  const isSalaryHorizon = Number.isFinite(daysUntilSalary) && daysUntilSalary > 0;

  const walletBalance = Number(settings?.walletBalance || 0);
  const dailyCarryoverPool = Number(settings?.dailyCarryoverPool || 0);
  const dailyRemainingBudget = useMemo(() => {
    const value =
      safeRecommendedSpend -
      currentMonthExpenseBeforeTodayNonRecurring -
      todaySpecialExpense +
      dailyCarryoverPool;
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
  }, [
    safeRecommendedSpend,
    currentMonthExpenseBeforeTodayNonRecurring,
    todaySpecialExpense,
    dailyCarryoverPool
  ]);
  const savingsRemainingForMonth = useMemo(
    () => Math.max(0, plannedMonthlySavings - currentMonthGoalSavingsExpense),
    [plannedMonthlySavings, currentMonthGoalSavingsExpense]
  );
  const dailySavingsReserve = useMemo(() => {
    if (dailyHorizonDays <= 0) return savingsRemainingForMonth;
    return savingsRemainingForMonth / dailyHorizonDays;
  }, [savingsRemainingForMonth, dailyHorizonDays]);

  const dailyLimitComputed = useMemo(() => {
    if (dailyHorizonDays <= 0) {
      return Math.floor(Math.max(0, dailyRemainingBudget - dailySavingsReserve));
    }
    const dailyBase = dailyRemainingBudget / dailyHorizonDays;
    return Math.floor(Math.max(0, dailyBase - dailySavingsReserve));
  }, [dailyRemainingBudget, dailyHorizonDays, dailySavingsReserve]);

  const dailyLimitFixed = useMemo(() => {
    const storedDate = settings?.dailyLimitDateISO;
    const storedValue = Number(settings?.dailyLimitValue);
    if (storedDate === todayISO && Number.isFinite(storedValue) && storedValue > 0) {
      return storedValue;
    }
    return dailyLimitComputed;
  }, [settings, todayISO, dailyLimitComputed]);

  const dailyLimitRemaining = useMemo(() => {
    const remaining = Number(dailyLimitFixed || 0) - Number(todayRegularExpense || 0);
    if (!Number.isFinite(remaining)) return 0;
    return remaining;
  }, [dailyLimitFixed, todayRegularExpense]);
  const factMonthlyNet = useMemo(() => statsMoneyCard.net, [statsMoneyCard.net]);

  const status = useMemo(
    () =>
      computeBudgetStatus({
        monthlyIncome,
        monthlyMandatory,
        recommendedMaxSpend
      }),
    [monthlyIncome, monthlyMandatory, recommendedMaxSpend]
  );

  const remainingToSpend = useMemo(
    () => Math.max(0, safeRecommendedSpend - currentMonthExpenseNonRecurring),
    [safeRecommendedSpend, currentMonthExpenseNonRecurring]
  );
  const currentRegularPace = useMemo(() => {
    const safeDays = Math.max(1, analysisDaysPassed);
    return currentMonthRegularExpenseNonRecurring / safeDays;
  }, [currentMonthRegularExpenseNonRecurring, analysisDaysPassed]);
  const projectedEndBalance = useMemo(() => {
    const avgDailyExpense = currentRegularPace;
    const remainingMoney = safeRecommendedSpend - currentMonthExpenseNonRecurring;
    const futureDays = Math.max(0, remainingDaysInMonth - 1);
    const projectedFutureExpense = avgDailyExpense * futureDays;
    return remainingMoney - projectedFutureExpense;
  }, [
    safeRecommendedSpend,
    currentMonthExpenseNonRecurring,
    currentRegularPace,
    remainingDaysInMonth
  ]);
  const dailyToZero = useMemo(() => {
    const remainingMoney = Math.max(0, safeRecommendedSpend - currentMonthExpenseNonRecurring);
    return dailyHorizonDays > 0 ? remainingMoney / dailyHorizonDays : remainingMoney;
  }, [
    safeRecommendedSpend,
    currentMonthExpenseNonRecurring,
    dailyHorizonDays
  ]);

  const chartSeries = useMemo(() => {
    const now = nowInTashkent();
    if (chartRange === "day") {
      return buildExpenseSeriesByHour(statsTransactions, now);
    }
    if (chartRange === "week") {
      return buildExpenseSeriesForDays(statsTransactions, now, 7);
    }
    if (chartRange === "month") {
      return buildExpenseSeriesByMonth(allTransactions, now, lang);
    }
    return buildExpenseSeries(statsTransactions, periodRange);
  }, [statsTransactions, periodRange, chartRange, allTransactions, lang]);

  const weeklyReport = useMemo(() => {
    const now = nowInTashkent();
    const todayStart = startOfDay(now);
    const currentStart = makeTashkentDate({ ...addDaysInTz(todayStart, -6), hour: 0, minute: 0, second: 0 });
    const prevStart = makeTashkentDate({ ...addDaysInTz(todayStart, -13), hour: 0, minute: 0, second: 0 });
    const prevEnd = endOfDay(makeTashkentDate({ ...addDaysInTz(todayStart, -7), hour: 0, minute: 0, second: 0 }));

    const current = summarizeRange(allTransactions, currentStart, endOfDay(todayStart));
    const previous = summarizeRange(allTransactions, prevStart, prevEnd);
    const expenseDelta = current.expense - previous.expense;
    const expenseDeltaPercent = previous.expense > 0 ? (expenseDelta / previous.expense) * 100 : null;

    return {
      current,
      previous,
      expenseDelta,
      expenseDeltaPercent,
      currentStartISO: formatDateISO(getTzParts(currentStart)),
      currentEndISO: formatDateISO(getTzParts(todayStart))
    };
  }, [allTransactions, dayTick]);

  const allRemindersEnabled = Boolean(settings?.remindersEnabled);
  const debtReminderEnabled = allRemindersEnabled && settings?.debtReminderEnabled !== false;
  const debtReminderSummary = useMemo(() => {
    const now = nowInTashkent();
    const openDebts = debts.filter((debt) => !debt.isClosed && Number(debt.remaining || 0) > 0);
    const overdue = [];
    const soon = [];
    const noDue = [];

    openDebts.forEach((debt) => {
      const dueDateISO = String(debt?.dueDateISO || "").slice(0, 10);
      if (!dueDateISO) {
        noDue.push(debt);
        return;
      }
      const daysToDue = dateDiffFromToday(dueDateISO, now);
      if (daysToDue === null) {
        noDue.push(debt);
        return;
      }
      const item = {
        id: debt.id,
        title: debt.title || "",
        amount: Number(debt.remaining || 0),
        dueDateISO,
        daysToDue
      };
      if (daysToDue < 0) {
        overdue.push(item);
      } else if (daysToDue <= 3) {
        soon.push(item);
      }
    });

    overdue.sort((a, b) => a.daysToDue - b.daysToDue);
    soon.sort((a, b) => a.daysToDue - b.daysToDue);
    noDue.sort((a, b) => debtLastActivityISO(a).localeCompare(debtLastActivityISO(b)));

    return {
      openCount: openDebts.length,
      overdue,
      soon,
      noDueCount: noDue.length
    };
  }, [debts, dayTick]);

  useEffect(() => {
    if (!debtReminderEnabled || debtReminderPermission !== "granted") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const candidates = [...debtReminderSummary.overdue, ...debtReminderSummary.soon];
    if (!candidates.length) return;

    const storageKey = "finance_track_debt_notifications_v1";
    const todayKey = dayTick;
    let sent = {};
    try {
      sent = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      sent = {};
    }

    candidates.slice(0, 3).forEach((item) => {
      const kind = item.daysToDue < 0 ? "overdue" : "soon";
      const mark = `${todayKey}:${item.id}:${kind}`;
      if (sent[mark]) return;

      const title = t("debtReminderPushTitle");
      const body =
        item.daysToDue < 0
          ? t("debtReminderOverduePush", {
              title: item.title || t("debtTitle"),
              days: String(Math.abs(item.daysToDue))
            })
          : t("debtReminderSoonPush", {
              title: item.title || t("debtTitle"),
              days: String(item.daysToDue)
            });

      new Notification(title, { body });
      sent[mark] = true;
    });

    localStorage.setItem(storageKey, JSON.stringify(sent));
  }, [debtReminderEnabled, debtReminderPermission, debtReminderSummary, dayTick, t]);

  const upcomingOneTime = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return payments
      .filter((p) => (p.recurrence || "oneTime") !== "monthly")
      .filter((p) => !p.payDateISO || p.payDateISO >= todayISO)
      .sort((a, b) => (a.payDateISO || "").localeCompare(b.payDateISO || ""))
      .slice(0, 3);
  }, [payments]);

  const periodTransactions = useMemo(
    () => filterByOccurredAtISO(allTransactions, periodRange.start, periodRange.end),
    [allTransactions, periodRange]
  );

  const walletMonthKey = settings?.walletMonthKey || "";
  const overspendAppliedMonthKey = settings?.overspendAppliedMonthKey || "";
  const overspendAppliedAmount = Number(settings?.overspendAppliedAmount || 0);
  const pendingCarryoverAmount = 0;
  const pendingCarryoverDate = "";

  useEffect(() => {
    if (!user || !settings) return;
    if (walletBalance < 0) {
      saveSettings(user.uid, { walletBalance: 0 });
      return;
    }
    const currentMonthKey = getMonthKey(new Date());
    if (walletMonthKey === currentMonthKey) return;

    const prevMonthDate = new Date(periodRange.start.getTime() - 24 * 60 * 60 * 1000);
    const prevRange = getMonthRangeFor(prevMonthDate);
    const prevTransactions = filterByOccurredAtISO(allTransactions, prevRange.start, prevRange.end);
    const prevStats = computeStats(prevTransactions);
    const prevMonthlyIncome = computeMonthlyIncome(prevTransactions, prevRange.days);
    const prevMonthlyExpense = computeMonthlyExpense(prevTransactions, prevRange.days);
    const prevMandatory = computeMandatoryMonthly(payments, prevRange.end);
    const prevPlannedSavings = computeRequiredMonthlySavings(activeGoal, prevStats.net, settings);
    const prevRecommendedSpend = computeRecommendedSpend({
      monthlyIncome: prevMonthlyIncome,
      monthlyMandatory: prevMandatory,
      plannedMonthlySavings: prevPlannedSavings,
      settings
    });
    const prevUnused = Math.max(0, (prevRecommendedSpend || 0) - prevMonthlyExpense);

    const nextBalance = walletBalance + prevUnused;
    saveSettings(user.uid, {
      walletBalance: nextBalance,
      walletMonthKey: currentMonthKey,
      walletLastCarryover: prevUnused,
      walletLastCarryoverMonth: getMonthKey(prevMonthDate)
    });

    if (prevUnused > 0) {
      setWalletNotice(t("walletCarry", { amount: formatAmount(prevUnused) }));
      setTimeout(() => setWalletNotice(""), 4000);
    }
  }, [
    user,
    settings,
    walletMonthKey,
    walletBalance,
    periodRange.start,
    allTransactions,
    payments,
    activeGoal
  ]);

  useEffect(() => {
    if (!user || !settings) return;
    const currentMonthKey = getMonthKey(new Date());
    const overspend = Math.max(0, currentMonthExpenseNonRecurring - safeRecommendedSpend);
    if (overspend <= 0) {
      if (overspendAppliedMonthKey !== currentMonthKey && overspendAppliedAmount !== 0) {
        saveSettings(user.uid, {
          overspendAppliedMonthKey: currentMonthKey,
          overspendAppliedAmount: 0
        });
      }
      return;
    }
    const appliedForMonth = overspendAppliedMonthKey === currentMonthKey ? overspendAppliedAmount : 0;
    const delta = Math.max(0, overspend - appliedForMonth);
    if (delta <= 0) return;
    const safeWallet = Math.max(0, Number(walletBalance || 0));
    const nextBalance = Math.max(0, safeWallet - delta);
    saveSettings(user.uid, {
      walletBalance: nextBalance,
      overspendAppliedMonthKey: currentMonthKey,
      overspendAppliedAmount: appliedForMonth + delta
    });
  }, [
    user,
    settings,
    walletBalance,
    currentMonthExpenseNonRecurring,
    safeRecommendedSpend,
    overspendAppliedMonthKey,
    overspendAppliedAmount
  ]);

  useEffect(() => {
    if (!user || !settings) return;
    const today = todayISO;
    if (settings.dailyLimitDateISO !== today) {
      let carryToWallet = 0;
      if (settings.dailyLimitDateISO) {
        const prevDate = settings.dailyLimitDateISO;
        const prevRegularSpent = allTransactions.reduce((sum, item) => {
          if (item.type !== "expense" || !item.occurredAtISO) return sum;
          const iso = item.occurredAtISO.slice(0, 10);
          if (iso !== prevDate) return sum;
          if (isSpecialExpense(item)) return sum;
          return sum + Number(item.amount || 0);
        }, 0);
        const prevLimit = Number(settings.dailyLimitValue || 0);
        carryToWallet = Math.max(0, prevLimit - prevRegularSpent);
      }

      const nextWalletBalance = walletBalance + carryToWallet;
      const nextRemainingBudget = Math.max(
        0,
        safeRecommendedSpend -
          currentMonthExpenseBeforeTodayNonRecurring -
          todaySpecialExpense
      );
      const nextDailyLimit =
        dailyHorizonDays > 0
          ? Math.floor(Math.max(0, nextRemainingBudget / dailyHorizonDays - dailySavingsReserve))
          : Math.floor(Math.max(0, nextRemainingBudget - dailySavingsReserve));

      saveSettings(user.uid, {
        ...(carryToWallet > 0 ? { walletBalance: nextWalletBalance } : {}),
        dailyLimitDateISO: today,
        dailyLimitValue: nextDailyLimit,
        dailyCarryoverPool: 0,
        dailyCarryoverPendingAmount: 0,
        dailyCarryoverPendingDateISO: ""
      });

      if (carryToWallet > 0) {
        setWalletNotice(t("walletCarry", { amount: formatAmount(carryToWallet) }));
        setTimeout(() => setWalletNotice(""), 4000);
      }
    }
  }, [
    user,
    settings,
    todayISO,
    allTransactions,
    walletBalance,
    safeRecommendedSpend,
    currentMonthExpenseBeforeTodayNonRecurring,
    todaySpecialExpense,
    dailyHorizonDays,
    dailySavingsReserve,
    t
  ]);

  useEffect(() => {
    if (!user || !settings) return;
    if (settings.dailyLimitDateISO !== todayISO) return;
    if (Number(settings.dailyLimitValue || 0) !== dailyLimitComputed) {
      saveSettings(user.uid, {
        dailyLimitValue: dailyLimitComputed
      });
    }
  }, [user, settings, todayISO, dailyLimitComputed]);

  useEffect(() => {
    if (pendingCarryoverAmount > 0 && pendingCarryoverDate) {
      setCarryoverModalOpen(true);
    }
  }, [pendingCarryoverAmount, pendingCarryoverDate]);

  const handleCarryoverChoice = async (choice) => {
    if (!user || !settings || pendingCarryoverAmount <= 0) return;
    if (choice === "distribute") {
      const nextPool = Number(settings.dailyCarryoverPool || 0) + pendingCarryoverAmount;
      await saveSettings(user.uid, {
        dailyCarryoverPool: nextPool,
        dailyCarryoverPendingAmount: 0,
        dailyCarryoverPendingDateISO: ""
      });
    } else if (choice === "goal") {
      if (activeGoal?.id) {
        await addGoalContribution(user.uid, activeGoal.id, pendingCarryoverAmount, activeGoal.title);
      } else {
        const nextBalance = walletBalance + pendingCarryoverAmount;
        await saveSettings(user.uid, { walletBalance: nextBalance });
      }
      await saveSettings(user.uid, {
        dailyCarryoverPendingAmount: 0,
        dailyCarryoverPendingDateISO: ""
      });
    } else if (choice === "wallet") {
      const nextBalance = walletBalance + pendingCarryoverAmount;
      await saveSettings(user.uid, {
        walletBalance: nextBalance,
        dailyCarryoverPendingAmount: 0,
        dailyCarryoverPendingDateISO: ""
      });
    }
    setCarryoverModalOpen(false);
  };

  return (
    <div className="dashboard-grid hide-side">
      {false && carryoverModalOpen && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setCarryoverModalOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>{t("dailyCarryoverTitle")}</strong>
                <GlassButton variant="ghost" onClick={() => setCarryoverModalOpen(false)}>
                  {t("close")}
                </GlassButton>
              </div>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="helper-text">
                  {t("dailyCarryoverText", {
                    date: pendingCarryoverDate,
                    amount: formatAmount(pendingCarryoverAmount)
                  })}
                </div>
                <div className="row">
                  <GlassButton onClick={() => handleCarryoverChoice("distribute")}>
                    {t("dailyCarryoverDistribute")}
                  </GlassButton>
                  <GlassButton onClick={() => handleCarryoverChoice("goal")}>
                    {t("dailyCarryoverGoal")}
                  </GlassButton>
                  <GlassButton onClick={() => handleCarryoverChoice("wallet")}>
                    {t("dailyCarryoverWallet")}
                  </GlassButton>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
      <div className="dashboard-main">
        <div className="dashboard-tiles">
          <div className="stat-tile tile-green">
            <div className="tile-icon"><Banknote size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("monthlySalary")}</div>
            <div className="tile-value">{formatAmount(Math.round(monthlySalaryCardAmount))}</div>
            <div className="tile-sub">{t("monthlySalary")}</div>
          </div>
          <div className="stat-tile tile-orange">
            <div className="tile-icon"><Receipt size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("mandatory")}</div>
            <div className="tile-value">{formatAmount(Math.round(monthlyMandatory))}</div>
            <div className="tile-sub">{t("monthlyMandatoryPayments")}</div>
          </div>
          <div className="stat-tile tile-red">
            <div className="tile-icon"><CreditCard size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("myDebtsCard")}</div>
            <div className="tile-value">{formatAmount(Math.round(myDebtsTotal))}</div>
            <div className="tile-sub">{t("myDebtsCard")}</div>
            <div className="tile-meta">
              {t("debtsCountLabel", { count: myDebtsCount.toLocaleString(lang === "uz" ? "uz-UZ" : "ru-RU") })}
            </div>
          </div>
          <div className="stat-tile tile-blue">
            <div className="tile-icon"><HandCoins size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("lentDebtsCard")}</div>
            <div className="tile-value">{formatAmount(Math.round(lentDebtsTotal))}</div>
            <div className="tile-sub">{t("lentDebtsCard")}</div>
            <div className="tile-meta">
              {t("debtsCountLabel", { count: lentDebtsCount.toLocaleString(lang === "uz" ? "uz-UZ" : "ru-RU") })}
            </div>
          </div>
          <div className="stat-tile tile-emerald">
            <div className="tile-icon"><WalletIcon size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("wallet")}</div>
            <div className={`tile-value ${walletBalance < 0 ? "tile-value-negative" : ""}`}>{formatAmount(walletBalance)}</div>
            <div className="tile-sub">{t("wallet")}</div>
          </div>
          <div className="stat-tile tile-blue">
            <div className="tile-icon"><TrendingDown size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("dailyAllowed")}</div>
            <div className={`tile-value ${dailyLimitRemaining < 0 ? "tile-value-negative" : ""}`}>
              {formatAmount(Math.round(dailyLimitRemaining))}
            </div>
            <div className="tile-sub">
              {isSalaryHorizon
                ? t("dailyLimitToSalaryLabel")
                : t("dailyLimitLabel", { days: dailyHorizonDays })}
            </div>
            {Number.isFinite(dailyToZero) && (
              <div className="tile-meta">
                {isSalaryHorizon
                  ? t("zeroToSalaryHint", { amount: formatAmount(Math.round(dailyToZero)) })
                  : t("endMonthZeroHint", { amount: formatAmount(Math.round(dailyToZero)) })}
              </div>
            )}
            {dailySavingsReserve > 0 && (
              <div className="tile-meta">
                {t("dailySavingsReserveHint", { amount: formatAmount(Math.round(dailySavingsReserve)) })}
              </div>
            )}
          </div>
          <div className="stat-tile tile-red">
            <div className="tile-icon"><CalendarClock size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("endMonthBalance")}</div>
            <div className={`tile-value ${projectedEndBalance < 0 ? "tile-value-negative" : ""}`}>
              {formatAmount(Math.round(projectedEndBalance))}
            </div>
            <div className="tile-sub">{t("endMonthForecast")}</div>
            {Number.isFinite(daysUntilSalary) && (
              <div className="tile-meta">{t("salaryDaysLeft", { days: daysUntilSalary })}</div>
            )}
          </div>
          <div className="stat-tile tile-purple">
            <div className="tile-icon"><Crosshair size={20} strokeWidth={2.5} /></div>
            <div className="tile-label">{t("goalAmount")}</div>
            <div className="tile-value">
              {formatAmount(Math.round(totalGoalsSaved))}{" "}
              <span className="tile-value-sub">/ {formatAmount(Math.round(totalGoalsTarget))}</span>
            </div>
            <div className="tile-sub">{t("goalAmount")}</div>
          </div>
        </div>
        {walletNotice && <div className="toast">{walletNotice}</div>}
        <BudgetCard
          monthlyIncome={monthlyIncome}
          monthlyMandatory={monthlyMandatory}
          recommendedMaxSpend={safeRecommendedSpend}
          currentMonthExpense={currentMonthExpenseNonRecurring}
          budgetMode={settings?.budgetMode || "auto"}
          planSpend={planSpend}
          warning={status.message}
          onOpenSettings={() => navigate("/settings")}
        />
        <div className="stats-split-container">
          <div className="stats-split-main">
            <StatsCard
              stats={statsMoneyCard}
              periodLabel={t("periodMonth")}
              monthlyNet={factMonthlyNet}
              series={chartSeries}
              dailyLimit={dailyLimitFixed}
              dailyRemaining={dailyLimitRemaining}
              daysInMonth={dailyHorizonDays}
              isSalaryHorizon={isSalaryHorizon}
              range={chartRange}
              onRangeChange={setChartRange}
            />
          </div>
          <div className="stats-split-side">
            <ExpenseCategoriesPie transactions={periodTransactions} />
          </div>
        </div>
        <div className="dashboard-insights-grid">
          <GlassCard className="dashboard-insight-card">
            <div className="insight-head">
              <div>
                <div className="insight-title">{t("weeklyReportTitle")}</div>
                <div className="insight-subtitle">
                  {weeklyReport.currentStartISO} - {weeklyReport.currentEndISO}
                </div>
              </div>
              <div
                className={`insight-chip ${
                  weeklyReport.expenseDelta > 0
                    ? "danger"
                    : weeklyReport.expenseDelta < 0
                      ? "success"
                      : "neutral"
                }`}
              >
                {weeklyReport.expenseDelta > 0
                  ? t("weeklyReportExpenseTrendUp", {
                      value:
                        weeklyReport.expenseDeltaPercent !== null
                          ? `${Math.abs(Math.round(weeklyReport.expenseDeltaPercent))}%`
                          : formatAmount(Math.abs(weeklyReport.expenseDelta))
                    })
                  : weeklyReport.expenseDelta < 0
                    ? t("weeklyReportExpenseTrendDown", {
                        value:
                          weeklyReport.expenseDeltaPercent !== null
                            ? `${Math.abs(Math.round(weeklyReport.expenseDeltaPercent))}%`
                            : formatAmount(Math.abs(weeklyReport.expenseDelta))
                      })
                    : t("weeklyReportExpenseTrendFlat")}
              </div>
            </div>

            <div className="insight-grid">
              <div className="insight-col">
                <div className="insight-col-title">{t("weeklyReportCurrent")}</div>
                <div className="insight-row">
                  <span>{t("weeklyReportIncome")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.current.income))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportExpense")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.current.expense))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportNet")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.current.net))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportOps")}</span>
                  <strong>{weeklyReport.current.ops}</strong>
                </div>
              </div>
              <div className="insight-col">
                <div className="insight-col-title">{t("weeklyReportPrevious")}</div>
                <div className="insight-row">
                  <span>{t("weeklyReportIncome")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.previous.income))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportExpense")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.previous.expense))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportNet")}</span>
                  <strong>{formatAmount(Math.round(weeklyReport.previous.net))}</strong>
                </div>
                <div className="insight-row">
                  <span>{t("weeklyReportOps")}</span>
                  <strong>{weeklyReport.previous.ops}</strong>
                </div>
              </div>
            </div>

            <div className="insight-footer">
              <CalendarDays size={16} />
              <span>{t("weeklyReportTopCategory")}:</span>
              <strong>
                {weeklyReport.current.topCategory
                  ? `${categoryLabel(weeklyReport.current.topCategory, t)} - ${formatAmount(
                      Math.round(weeklyReport.current.topCategoryAmount)
                    )}`
                  : t("weeklyReportNoCategory")}
              </strong>
            </div>
          </GlassCard>

          <GlassCard className="dashboard-insight-card">
            <div className="insight-head">
              <div>
                <div className="insight-title">{t("debtRemindersTitle")}</div>
                <div className="insight-subtitle">{t("debtRemindersSubtitle")}</div>
              </div>
              <div className="insight-chip neutral">
                {t("debtReminderOpenCount", {
                  count: debtReminderSummary.openCount.toLocaleString(lang === "uz" ? "uz-UZ" : "ru-RU")
                })}
              </div>
            </div>

            <div className="debt-reminder-controls">
              <div className="helper-text">
                {debtReminderPermission === "unsupported"
                  ? t("allRemindersUnsupported")
                  : debtReminderPermission === "denied"
                    ? t("allRemindersDenied")
                    : debtReminderEnabled
                      ? t("allRemindersOn")
                      : t("allRemindersOff")}
              </div>
            </div>

            <div className="debt-reminder-lists">
              <div>
                <div className="insight-col-title danger">
                  <AlertTriangle size={14} />
                  {t("debtReminderOverdue")}
                </div>
                {debtReminderSummary.overdue.length ? (
                  debtReminderSummary.overdue.slice(0, 4).map((item) => (
                    <div className="insight-row" key={`overdue-${item.id}`}>
                      <span>{item.title || t("debtTitle")}</span>
                      <strong>
                        {formatAmount(Math.round(item.amount))} -{" "}
                        {t("debtReminderOverdueDays", { days: Math.abs(item.daysToDue) })}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div className="muted">{t("debtReminderNone")}</div>
                )}
              </div>

              <div>
                <div className="insight-col-title">
                  <CalendarClock size={14} />
                  {t("debtReminderSoon")}
                </div>
                {debtReminderSummary.soon.length ? (
                  debtReminderSummary.soon.slice(0, 4).map((item) => (
                    <div className="insight-row" key={`soon-${item.id}`}>
                      <span>{item.title || t("debtTitle")}</span>
                      <strong>
                        {formatAmount(Math.round(item.amount))} -{" "}
                        {item.daysToDue === 0
                          ? t("debtReminderToday")
                          : t("debtReminderInDays", { days: item.daysToDue })}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div className="muted">{t("debtReminderNone")}</div>
                )}
              </div>
            </div>

            {debtReminderSummary.noDueCount > 0 && (
              <div className="insight-footer">
                <span>
                  {t("debtReminderNoDue", {
                    count: debtReminderSummary.noDueCount.toLocaleString(lang === "uz" ? "uz-UZ" : "ru-RU")
                  })}
                </span>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
      <div className="dashboard-side">
        <PaymentsOverview payments={payments} />
        {import.meta.env.DEV && (
          <details className="glass-card">
            <summary className="card-title dev-summary">Проверка расчётов (dev)</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <div>
                Период (месяц): {periodRange.startISO} → {periodRange.endISO}
              </div>
              <div>Транзакции в периоде: {periodTransactions.length}</div>
              <div>Факт: пришло {formatAmount(stats.income)}, потрачено {formatAmount(stats.expense)}, остаётся {formatAmount(stats.net)}</div>
              <div>Месячный доход: {formatAmount(monthlyIncome)}</div>
              <div>Месячный расход: {formatAmount(monthlyExpense)}</div>
              <div>Ежемесячные обязательные: {formatAmount(monthlyMandatory)}</div>
              <div>План накоплений: {formatAmount(plannedMonthlySavings)}</div>
              <div>Рекомендовано тратить: {formatAmount(recommendedMaxSpend)}</div>
              <div>Плановый остаток (на цели): {formatAmount(plannedMonthlyNet)}</div>
              <div>Проверка: обязательные + накопления + можно тратить = {formatAmount(monthlyMandatory + plannedMonthlySavings + planSpend)}</div>
              <div>Настройки бюджета: {settings?.budgetMode || "auto"}</div>
              <div>Ручной бюджет: {formatAmount(settings?.manualMonthlyBudget || 0)}</div>
              <div>Режим накоплений: {settings?.targetSavingsMode || "goal_based"}</div>
              <div>Фикс накоплений: {formatAmount(settings?.fixedMonthlySavings || 0)}</div>
              <div>Активная цель: {activeGoal?.title || "-"}</div>
              <div className="stack" style={{ marginTop: 8 }}>
                <strong>Ежемесячные платежи:</strong>
                {payments
                  .filter((p) => (p.recurrence || "oneTime") === "monthly")
                  .map((p) => (
                    <div key={p.id}>
                      {p.title} • {formatAmount(p.amount)}
                    </div>
                  ))}
                {!payments.some((p) => (p.recurrence || "oneTime") === "monthly") && (
                  <div className="muted">Нет ежемесячных платежей.</div>
                )}
              </div>
              <div className="stack" style={{ marginTop: 8 }}>
                <strong>Транзакции в периоде:</strong>
                {periodTransactions.map((tx) => (
                  <div key={tx.id}>
                    {tx.occurredAtISO} • {tx.type} • {formatAmount(tx.amount)} • {tx.raw}
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
