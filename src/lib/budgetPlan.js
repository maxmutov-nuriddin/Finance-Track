import { addMonthsInTz, formatDateISO, getTzParts, makeTashkentDate } from "./timezone";
import { getMonthRangeFor } from "./utils";

const SALARY_WORDS = ["зп", "зарплат", "salary", "maosh", "oylik", "аванс", "премия", "бонус"];

const DEBT_MIN_FIELDS = [
  "minPayment",
  "minimumPayment",
  "monthlyMin",
  "monthlyPayment",
  "payment",
  "min"
];

function safeNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function isSameMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

function getTxDate(tx) {
  if (tx?.occurredAtISO) {
    const date = new Date(tx.occurredAtISO);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (tx?.occurredAt?.toDate) {
    return tx.occurredAt.toDate();
  }
  if (tx?.occurredAt instanceof Date) {
    return tx.occurredAt;
  }
  return null;
}

function isGoalContribution(tx) {
  if (tx?.meta?.kind === "goal_contribution") return true;
  if (tx?.meta?.goalId) return true;
  const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
  return text.includes("накоп");
}

function isTransferTx(tx) {
  if (tx?.meta?.kind === "transfer") return true;
  if (tx?.category === "carryover") return true;
  return false;
}

function isExpenseLike(tx) {
  return tx?.type !== "income";
}

function isRecurringIncome(tx) {
  if (!tx || tx.type !== "income") return false;
  if (tx.isRecurring || tx.incomePeriod === "monthly") return true;
  const text = `${tx.description || ""} ${tx.raw || ""}`.toLowerCase();
  return SALARY_WORDS.some((word) => text.includes(word));
}

function computeRecurringIncomeExpected(transactions, nowParts) {
  const recentLimit = new Date();
  recentLimit.setDate(recentLimit.getDate() - 120);
  const recurring = [];
  transactions.forEach((tx) => {
    if (!isRecurringIncome(tx)) return;
    const date = getTxDate(tx);
    if (!date || date < recentLimit) return;
    recurring.push({ amount: safeNumber(tx.amount), date });
  });
  recurring.sort((a, b) => b.date - a.date);
  const receivedThisMonth = recurring.some((entry) =>
    isSameMonth(entry.date, nowParts.year, nowParts.month)
  );
  if (receivedThisMonth) return 0;
  const sample = recurring.slice(0, 3);
  if (!sample.length) return 0;
  const avg = sample.reduce((sum, item) => sum + item.amount, 0) / sample.length;
  return Math.round(avg);
}

function computeDebtMinimums(debts) {
  return (debts || []).reduce((sum, debt) => {
    const remaining = safeNumber(debt?.remaining || debt?.amount);
    if (remaining <= 0 || debt?.isClosed) return sum;
    let minPayment = 0;
    for (const field of DEBT_MIN_FIELDS) {
      if (debt?.[field]) {
        minPayment = safeNumber(debt[field]);
        break;
      }
    }
    return sum + minPayment;
  }, 0);
}

function computeMandatoryPayments(payments, nowParts) {
  return (payments || []).reduce((sum, pay) => {
    const recurrence = pay?.recurrence || "oneTime";
    if (recurrence === "monthly") {
      return sum + safeNumber(pay.amount);
    }
    if (recurrence === "oneTime" && pay?.payDateISO) {
      const date = new Date(`${pay.payDateISO}T00:00:00`);
      if (!Number.isNaN(date.getTime()) && isSameMonth(date, nowParts.year, nowParts.month)) {
        return sum + safeNumber(pay.amount);
      }
    }
    return sum;
  }, 0);
}

function computeHistoricalDailySpend(transactions, nowDate, windowDays = 30) {
  const nowTime = nowDate.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const fromTime = nowTime - windowMs;
  const total = (transactions || []).reduce((sum, tx) => {
    if (!isExpenseLike(tx)) return sum;
    if (isTransferTx(tx)) return sum;
    if (isGoalContribution(tx)) return sum;
    const date = getTxDate(tx);
    if (!date) return sum;
    const time = date.getTime();
    if (time < fromTime || time > nowTime) return sum;
    return sum + Math.abs(safeNumber(tx.amount));
  }, 0);
  return total / Math.max(1, windowDays);
}

export function buildMonthlyPlan({
  wallet = 0,
  transactions = [],
  payments = [],
  debts = [],
  settings = {},
  now = new Date()
}) {
  const nowParts = getTzParts(now);
  const monthRange = getMonthRangeFor(now);
  const daysInMonth = monthRange.days;
  const daysLeft = Math.max(1, daysInMonth - nowParts.day + 1);
  const todayISO = formatDateISO(nowParts);

  const incomeThisMonth = [];
  const expenseThisMonth = [];

  transactions.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date || !isSameMonth(date, nowParts.year, nowParts.month)) return;
    if (tx.type === "income") {
      incomeThisMonth.push(tx);
    } else if (isExpenseLike(tx)) {
      expenseThisMonth.push(tx);
    }
  });

  const expectedIncomeActual = incomeThisMonth.reduce(
    (sum, tx) => sum + safeNumber(tx.amount),
    0
  );
  const recurringIncomeExpected = computeRecurringIncomeExpected(transactions, nowParts);
  const expectedIncome = expectedIncomeActual + recurringIncomeExpected;

  const mandatoryPayments =
    computeMandatoryPayments(payments, nowParts) + computeDebtMinimums(debts);

  const spentSoFar = expenseThisMonth.reduce((sum, tx) => {
    if (isGoalContribution(tx)) return sum;
    if (isTransferTx(tx)) return sum;
    return sum + Math.abs(safeNumber(tx.amount));
  }, 0);
  const goalSavedThisMonth = expenseThisMonth.reduce((sum, tx) => {
    if (!isGoalContribution(tx)) return sum;
    return sum + Math.abs(safeNumber(tx.amount));
  }, 0);

  const availableToSpend =
    safeNumber(wallet) + expectedIncome - mandatoryPayments - spentSoFar;

  const daysPassed = Math.max(1, nowParts.day);
  const currentAvgDaily = spentSoFar / daysPassed;
  const historicalAvgDaily = computeHistoricalDailySpend(transactions, now, 30);
  const avgDailySpent = Math.max(currentAvgDaily, historicalAvgDaily);
  let lifeBudget = avgDailySpent * daysLeft;

  let spendBudget = availableToSpend;
  if (settings?.budgetMode === "manual" && safeNumber(settings?.manualMonthlyBudget) > 0) {
    const manualBudget = safeNumber(settings.manualMonthlyBudget);
    const manualRemaining = Math.max(0, manualBudget - spentSoFar);
    lifeBudget = manualRemaining;
    spendBudget = Math.min(availableToSpend, manualRemaining);
  } else {
    spendBudget = Math.min(availableToSpend, lifeBudget);
  }

  const dailyBase = Math.max(0, Math.min(availableToSpend, lifeBudget));
  const dailyLimit = daysLeft > 0 ? Math.floor(dailyBase / daysLeft) : Math.floor(dailyBase);

  const todaySpent = expenseThisMonth.reduce((sum, tx) => {
    if (isGoalContribution(tx)) return sum;
    if (!tx?.occurredAtISO || tx.occurredAtISO.slice(0, 10) !== todayISO) return sum;
    return sum + safeNumber(tx.amount);
  }, 0);

  const dailyRemaining = Math.round(dailyLimit - todaySpent);
  const safeToSave = Math.max(0, availableToSpend - lifeBudget - goalSavedThisMonth);

  return {
    now,
    month: {
      year: nowParts.year,
      month: nowParts.month,
      startISO: monthRange.startISO,
      endISO: monthRange.endISO,
      daysInMonth,
      daysLeft,
      todayISO
    },
    expectedIncome,
    expectedIncomeActual,
    recurringIncomeExpected,
    mandatoryPayments,
    spentSoFar,
    availableToSpend,
    spendBudget,
    daysPassed,
    avgDailySpent,
    dailyLimit,
    dailyRemaining,
    safeToSave,
    goalSavedThisMonth,
    risk: availableToSpend < 0
  };
}

export function computeGoalPlan(goal, plan, settings = {}) {
  const saved = safeNumber(goal?.currentAmount ?? goal?.savedAmount);
  const targetAmount = safeNumber(goal?.targetAmount);
  const remaining = Math.max(0, targetAmount - saved);
  const isCompleted = Boolean(goal?.isCompleted || goal?.completedAt) || remaining <= 0;
  const progress = targetAmount
    ? Math.min(100, Math.round((saved / targetAmount) * 100))
    : 0;

  let recommendedMonthly = 0;
  const maxForecastMonths = 1200;

  const targetSavingsMode = settings?.targetSavingsMode || "goal_based";
  const fixedMonthlySavings = safeNumber(settings?.fixedMonthlySavings);
  const safeToSave = safeNumber(plan?.safeToSave);

  if (targetSavingsMode === "fixed" && fixedMonthlySavings > 0) {
    recommendedMonthly = Math.min(fixedMonthlySavings, safeToSave);
  } else if (goal?.mode === "manual") {
    recommendedMonthly = Math.min(safeNumber(goal?.monthlyTarget), safeToSave);
  } else {
    const cap = safeNumber(goal?.monthlyCap);
    recommendedMonthly = cap > 0 ? Math.min(safeToSave, cap) : safeToSave;
  }

  recommendedMonthly = Math.max(0, Math.round(recommendedMonthly));
  if (remaining > 0 && recommendedMonthly > remaining) {
    recommendedMonthly = remaining;
  }

  let monthsLeft = null;
  if (remaining <= 0) {
    monthsLeft = 0;
  } else if (recommendedMonthly > 0) {
    monthsLeft = Math.ceil(remaining / recommendedMonthly);
    if (monthsLeft > maxForecastMonths) {
      monthsLeft = null;
    }
  }

  const forecastDateISO =
    monthsLeft && monthsLeft > 0
      ? formatDateISO(addMonthsInTz(makeTashkentDate(getTzParts(plan?.now || new Date())), monthsLeft))
      : null;

  const risk = Boolean(plan?.risk || safeNumber(plan?.availableToSpend) < 0);
  const pendingIncome = safeNumber(plan?.recurringIncomeExpected) > 0;
  let status = "ok";
  if (isCompleted) {
    status = "done";
  } else if (risk) {
    status = "risk";
  } else if (recommendedMonthly <= 0 || monthsLeft === null) {
    status = pendingIncome ? "paused" : "paused";
  }

  return {
    saved,
    targetAmount,
    remaining,
    recommendedMonthly,
    monthsLeft,
    forecastDateISO,
    isCompleted,
    progress,
    status
  };
}

export function isGoalContributionTx(tx) {
  return isGoalContribution(tx);
}
