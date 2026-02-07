import { getTzParts } from "./timezone";

function isDebtIncomeTransaction(tx) {
  return tx?.type === "income" && tx?.category === "debt";
}

export function computeMonthlyIncome(transactions, days) {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .filter((t) => !isDebtIncomeTransaction(t))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  if (!days || days <= 0) return Math.round(totalIncome);
  return Math.round(totalIncome);
}

export function computeMonthlyExpense(transactions, days) {
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  if (!days || days <= 0) return Math.round(totalExpense);
  return Math.round(totalExpense);
}

export function computeMandatoryMonthly(payments, nowDate = new Date()) {
  const nowParts = getTzParts(nowDate);
  return payments.reduce((sum, pay) => {
    const recurrence = pay.recurrence || "oneTime";
    if (recurrence === "monthly") {
      return sum + Number(pay.amount || 0);
    }
    if (recurrence === "oneTime" && pay.payDateISO) {
      const parts = getTzParts(new Date(`${pay.payDateISO}T00:00:00`));
      if (parts.year === nowParts.year && parts.month === nowParts.month) {
        return sum + Number(pay.amount || 0);
      }
    }
    return sum;
  }, 0);
}

export function computeRecurringMonthlyFromTransactions(transactions, nowDate = new Date()) {
  const nowParts = getTzParts(nowDate);
  return transactions.reduce((sum, item) => {
    if (!item?.isRecurring || item.type !== "expense" || !item.occurredAtISO) return sum;
    const parts = getTzParts(new Date(item.occurredAtISO));
    if (parts.year === nowParts.year && parts.month === nowParts.month) {
      return sum + Number(item.amount || 0);
    }
    return sum;
  }, 0);
}

export function getActiveGoal(goals, settings) {
  if (!goals?.length) return null;
  if (settings?.activeGoalId) {
    return goals.find((g) => g.id === settings.activeGoalId) || goals[0];
  }
  return goals[0];
}

export function computeRequiredMonthlySavings(activeGoal, _statsNet, settings) {
  if (settings?.targetSavingsMode === "fixed" && settings.fixedMonthlySavings) {
    return Number(settings.fixedMonthlySavings);
  }
  if (!activeGoal) return 0;
  const currentSavings = Math.max(0, Number(activeGoal.currentAmount || 0));
  const remaining = Math.max(0, activeGoal.targetAmount - currentSavings);
  const manualDateISO = activeGoal.manualTargetDateISO;
  if (manualDateISO) {
    const target = new Date(`${manualDateISO}T00:00:00`);
    const today = new Date();
    const diffDays = Math.max(
      1,
      Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
    );
    const monthsLeft = Math.max(1, Math.ceil(diffDays / 30));
    return Math.ceil(remaining / monthsLeft);
  }
  return Math.ceil(remaining / 6);
}

export function computeRecommendedSpend({
  monthlyIncome,
  monthlyMandatory,
  plannedMonthlySavings,
  settings
}) {
  if (settings?.budgetMode === "manual" && settings.manualMonthlyBudget) {
    return Math.round(Number(settings.manualMonthlyBudget));
  }
  return Math.round(monthlyIncome - monthlyMandatory - plannedMonthlySavings);
}

export function computeMonthExpense(transactions) {
  const nowParts = getTzParts(new Date());
  const year = nowParts.year;
  const month = nowParts.month;
  return transactions.reduce((sum, item) => {
    if (item.type !== "expense" || !item.occurredAtISO) return sum;
    const parts = getTzParts(new Date(item.occurredAtISO));
    if (parts.year === year && parts.month === month) {
      return sum + Number(item.amount || 0);
    }
    return sum;
  }, 0);
}
