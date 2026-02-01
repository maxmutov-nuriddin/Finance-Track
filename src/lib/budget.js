export function computeBudgetStatus({
  monthlyIncome,
  monthlyMandatory,
  recommendedMaxSpend
}) {
  if (!monthlyIncome) {
    return {
      status: "no_income",
      message: "Добавь доход (зп), чтобы мы рассчитали бюджет."
    };
  }
  if (Number.isNaN(recommendedMaxSpend)) {
    return {
      status: "invalid",
      message: "Не удалось рассчитать бюджет. Проверь данные."
    };
  }
  if (recommendedMaxSpend < 0) {
    return {
      status: "negative",
      message: "С текущим доходом и обязательными платежами цель в выбранный срок недостижима."
    };
  }
  return { status: "ok", message: "" };
}

export function computeBudgetProgress(currentExpense, recommendedMaxSpend) {
  if (!recommendedMaxSpend || recommendedMaxSpend <= 0) {
    return { progress: 0, overspent: false };
  }
  const ratio = currentExpense / recommendedMaxSpend;
  return {
    progress: Math.min(100, Math.round(ratio * 100)),
    overspent: ratio > 1
  };
}
