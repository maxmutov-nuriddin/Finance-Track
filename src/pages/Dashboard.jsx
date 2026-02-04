import { useEffect, useMemo, useState } from "react";
import BudgetCard from "../components/BudgetCard";
import GlassCard from "../components/GlassCard";
import PaymentsOverview from "../components/PaymentsOverview";
import StatsCard from "../components/StatsCard";
import ExpenseCategoriesPie from "../components/ExpenseCategoriesPie";
import { useUser } from "../lib/user";
import {
  addGoalContribution,
  addTransaction,
  watchGoals,
  watchPayments,
  watchTransactions,
  watchSettings,
  saveSettings
} from "../lib/store";
import { addDaysInTz, addMonthsInTz, formatDateISO, formatISOWithOffset, getTzParts, makeTashkentDate, nowInTashkent } from "../lib/timezone";
import { useNavigate } from "react-router-dom";
import { computeBudgetStatus } from "../lib/budget";
import { filterByOccurredAtISO, getMonthKey, getMonthRange, getMonthRangeFor } from "../lib/utils";
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

function getSalaryDay(transactions) {
  const salaryWords = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];
  const now = new Date();
  const limit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const incomePool = [];
  const salaryPool = [];

  transactions.forEach((item) => {
    if (item?.type !== "income" || !item?.occurredAtISO) return;
    const date = new Date(item.occurredAtISO);
    if (date < limit) return;
    const parts = getTzParts(date);
    const entry = { day: parts.day, date };
    incomePool.push(entry);
    const text = `${item.description || ""} ${item.raw || ""}`.toLowerCase();
    if (salaryWords.some((word) => text.includes(word))) {
      salaryPool.push(entry);
    }
  });

  const pool = salaryPool.length >= 2 ? salaryPool : incomePool;
  if (!pool.length) return null;

  const stats = new Map();
  pool.forEach((entry) => {
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

export default function Dashboard() {
  const user = useUser();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [goals, setGoals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [walletNotice, setWalletNotice] = useState("");
  const [monthTick, setMonthTick] = useState(getMonthKey(new Date()));
  const [carryoverModalOpen, setCarryoverModalOpen] = useState(false);
  const [chartRange, setChartRange] = useState("month");

  useEffect(() => {
    if (!user) return;
    const unsubGoals = watchGoals(user.uid, setGoals);
    const unsubPayments = watchPayments(user.uid, setPayments);
    const unsubAll = watchTransactions(user.uid, setAllTransactions);
    const unsubSettings = watchSettings(user.uid, setSettings);
    return () => {
      unsubGoals();
      unsubPayments();
      unsubAll();
      unsubSettings();
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextKey = getMonthKey(new Date());
      setMonthTick((prev) => (prev === nextKey ? prev : nextKey));
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
    const salaryWords = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];
    let earliestSalary = null;
    statsTransactions.forEach((item) => {
      if (item?.type !== "income" || !item?.occurredAtISO) return;
      const text = `${item.description || ""} ${item.raw || ""}`.toLowerCase();
      const isSalary = salaryWords.some((word) => text.includes(word));
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
  const salaryDay = useMemo(() => getSalaryDay(allTransactions), [allTransactions]);
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
  }, [salaryDay]);
  const monthlyIncome = useMemo(
    () => computeMonthlyIncome(statsTransactions, periodDays),
    [statsTransactions, periodDays]
  );
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

  const todayISO = useMemo(() => formatDateISO(getTzParts(nowInTashkent())), []);
  const todayExpense = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      const iso = item.occurredAtISO.slice(0, 10);
      if (iso !== todayISO) return sum;
      return sum + Number(item.amount || 0);
    }, 0);
  }, [allTransactions, todayISO]);

  const todaySpecialExpense = useMemo(() => {
    return allTransactions.reduce((sum, item) => {
      if (item.type !== "expense" || !item.occurredAtISO) return sum;
      const iso = item.occurredAtISO.slice(0, 10);
      if (iso !== todayISO) return sum;
      const category = item.category || "";
      const description = (item.description || "").toLowerCase();
      const raw = (item.raw || "").toLowerCase();
      const isGoal = description.includes("накоп") || raw.includes("накоп");
      const isDebt = category === "credit" || raw.includes("долг") || raw.includes("кредит");
      if (isGoal || isDebt) {
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
  }, [periodRange.end]);

  const dailyLimitFixed = useMemo(() => {
    const storedDate = settings?.dailyLimitDateISO;
    const storedValue = Number(settings?.dailyLimitValue || 0);
    if (storedDate === todayISO && storedValue > 0 && todaySpecialExpense <= 0) {
      return storedValue;
    }
    const carryPool = Number(settings?.dailyCarryoverPool || 0);
    const remainingBase =
      monthlyIncome -
      monthlyMandatory -
      plannedMonthlySavings -
      currentMonthExpenseBeforeTodayNonRecurring -
      todaySpecialExpense +
      carryPool;
    const value = remainingBase / remainingDaysInMonth;
    return Number.isFinite(value) ? value : 0;
  }, [
    settings,
    todayISO,
    monthlyIncome,
    monthlyMandatory,
    plannedMonthlySavings,
    currentMonthExpenseBeforeTodayNonRecurring,
    remainingDaysInMonth,
    todaySpecialExpense
  ]);

  const dailyLimitRemaining = useMemo(() => {
    const remaining = Number(dailyLimitFixed || 0) - Number(todayRegularExpense || 0);
    if (!Number.isFinite(remaining)) return 0;
    return remaining;
  }, [dailyLimitFixed, todayRegularExpense]);
  const factMonthlyNet = useMemo(() => stats.net, [stats.net]);

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
  const projectedEndBalance = useMemo(() => {
    const avgDailyExpense = currentMonthExpenseNonRecurring / analysisDaysPassed;
    const remainingMoney =
      monthlyIncome - monthlyMandatory - plannedMonthlySavings - currentMonthExpenseNonRecurring;
    const projectedFutureExpense = avgDailyExpense * remainingDaysInMonth;
    return remainingMoney - projectedFutureExpense;
  }, [
    monthlyIncome,
    monthlyMandatory,
    plannedMonthlySavings,
    currentMonthExpenseNonRecurring,
    analysisDaysPassed,
    remainingDaysInMonth
  ]);
  const dailyToZero = useMemo(() => {
    const remainingMoney =
      monthlyIncome - monthlyMandatory - plannedMonthlySavings - currentMonthExpenseNonRecurring;
    return remainingDaysInMonth > 0 ? remainingMoney / remainingDaysInMonth : remainingMoney;
  }, [
    monthlyIncome,
    monthlyMandatory,
    plannedMonthlySavings,
    currentMonthExpenseNonRecurring,
    remainingDaysInMonth
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

  const walletBalance = Number(settings?.walletBalance || 0);
  const walletMonthKey = settings?.walletMonthKey || "";
  const overspendAppliedMonthKey = settings?.overspendAppliedMonthKey || "";
  const overspendAppliedAmount = Number(settings?.overspendAppliedAmount || 0);
  const pendingCarryoverAmount = 0;
  const pendingCarryoverDate = "";

  useEffect(() => {
    if (!user || !settings) return;
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
    saveSettings(user.uid, {
      walletBalance: walletBalance - delta,
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
      if (settings.dailyLimitDateISO) {
        const prevDate = settings.dailyLimitDateISO;
        const prevSpent = allTransactions.reduce((sum, item) => {
          if (item.type !== "expense" || !item.occurredAtISO) return sum;
          const iso = item.occurredAtISO.slice(0, 10);
          if (iso !== prevDate) return sum;
          return sum + Number(item.amount || 0);
        }, 0);
        const prevLimit = Number(settings.dailyLimitValue || 0);
        const leftover = Math.max(0, prevLimit - prevSpent);
        if (leftover > 0) {
          const nextBalance = walletBalance + leftover;
          saveSettings(user.uid, {
            walletBalance: nextBalance,
            dailyCarryoverPendingAmount: 0,
            dailyCarryoverPendingDateISO: ""
          });
          const nowParts = getTzParts(nowInTashkent());
          addTransaction(user.uid, {
            amount: leftover,
            occurredAt: makeTashkentDate(nowParts),
            occurredAtISO: formatISOWithOffset(nowParts),
            category: "carryover",
            type: "income",
            description: t("carryoverTitle"),
            raw: "carryover"
          });
          setWalletNotice(t("walletCarry", { amount: formatAmount(leftover) }));
          setTimeout(() => setWalletNotice(""), 4000);
        }
      }

      const carryPool = 0;
      const remainingBase =
        monthlyIncome -
        monthlyMandatory -
        plannedMonthlySavings -
        currentMonthExpenseBeforeTodayNonRecurring +
        carryPool;
      const nextDailyLimit = Math.round(remainingBase / remainingDaysInMonth);
      saveSettings(user.uid, {
        dailyLimitDateISO: today,
        dailyLimitValue: nextDailyLimit,
        dailyCarryoverPool: 0
      });
    }
  }, [
    user,
    settings,
    todayISO,
    allTransactions,
    monthlyIncome,
    monthlyMandatory,
    plannedMonthlySavings,
    currentMonthExpenseBeforeTodayNonRecurring,
    remainingDaysInMonth,
    todaySpecialExpense
  ]);

  useEffect(() => {
    if (!user || !settings) return;
    if (settings.dailyLimitDateISO !== todayISO) return;
    if (todaySpecialExpense <= 0) return;
    const carryPool = Number(settings.dailyCarryoverPool || 0);
    const remainingBase =
      monthlyIncome -
      monthlyMandatory -
      plannedMonthlySavings -
      currentMonthExpenseBeforeTodayNonRecurring -
      todaySpecialExpense +
      carryPool;
    const nextDailyLimit = Math.round(remainingBase / remainingDaysInMonth);
    if (Math.round(Number(settings.dailyLimitValue || 0)) !== nextDailyLimit) {
      saveSettings(user.uid, {
        dailyLimitValue: nextDailyLimit
      });
    }
  }, [
    user,
    settings,
    todayISO,
    todaySpecialExpense,
    monthlyIncome,
    monthlyMandatory,
    plannedMonthlySavings,
    currentMonthExpenseBeforeTodayNonRecurring,
    remainingDaysInMonth
  ]);

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
            <div className="tile-label">{t("monthlySalary")}</div>
            <div className="tile-value">{formatAmount(Math.round(monthlyIncome))}</div>
            <div className="tile-sub">{t("monthlySalary")}</div>
          </div>
          <div className="stat-tile tile-red">
            <div className="tile-label">{t("endMonthBalance")}</div>
            <div className="tile-value">{formatAmount(Math.round(projectedEndBalance))}</div>
            <div className="tile-sub">{t("endMonthForecast")}</div>
            {Number.isFinite(daysUntilSalary) && (
              <div className="tile-meta">{t("salaryDaysLeft", { days: daysUntilSalary })}</div>
            )}
            <div className="tile-corner">
              {formatAmount(Math.round(dailyToZero))}
            </div>
          </div>
          <div className="stat-tile tile-emerald">
            <div className="tile-label">{t("wallet")}</div>
            <div className="tile-value">{formatAmount(walletBalance)}</div>
            <div className="tile-sub">{t("wallet")}</div>
          </div>
          <div className="stat-tile tile-blue">
            <div className="tile-label">{t("dailyAllowed")}</div>
            <div className="tile-value">{formatAmount(Math.round(dailyLimitRemaining))}</div>
            <div className="tile-sub">{t("dailyLimitLabel", { days: periodDays })}</div>
          </div>
          <div className="stat-tile tile-orange">
            <div className="tile-label">{t("mandatory")}</div>
            <div className="tile-value">{formatAmount(Math.round(monthlyMandatory))}</div>
            <div className="tile-sub">{t("monthlyMandatoryPayments")}</div>
          </div>
          <div className="stat-tile tile-purple">
            <div className="tile-label">{t("goalAmount")}</div>
            <div className="tile-value">
              {formatAmount(Math.round(totalGoalsSaved))}{" "}
              <span className="tile-value-sub">/ {formatAmount(Math.round(totalGoalsTarget))}</span>
            </div>
            <div className="tile-sub">{t("goalAmount")}</div>
          </div>
        </div>
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
        <StatsCard
          stats={stats}
          periodLabel={t("periodMonth")}
          monthlyNet={factMonthlyNet}
          series={chartSeries}
          dailyLimit={dailyLimitFixed}
          dailyRemaining={dailyLimitRemaining}
          daysInMonth={periodDays}
          range={chartRange}
          onRangeChange={setChartRange}
        />
      </div>
      <div className="dashboard-side">
        <PaymentsOverview payments={payments} />
        <ExpenseCategoriesPie transactions={periodTransactions} />
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
