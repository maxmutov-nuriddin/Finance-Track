import { useMemo } from "react";
import { Flame, Utensils, Car, Target, CircleCheck, Theater, TrendingDown } from "lucide-react";
import { getTzParts } from "../lib/timezone";
import { formatAmount } from "../lib/format";

const FOOD_CATS = ["cafe", "groceries", "food"];
const TRANSPORT_CATS = ["transport"];
const FUN_CATS = ["entertainment", "shopping", "beauty"];

function groupByCategory(transactions) {
  const result = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const cat = tx.category || "other";
    result[cat] = (result[cat] || 0) + Number(tx.amount || 0);
  }
  return result;
}

function getDaysElapsed() {
  return Math.max(1, new Date().getDate());
}

function getDaysInMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function computeInsights({ transactions, monthlyIncome, recommendedSpend, activeGoal }) {
  const insights = [];
  if (!transactions?.length || !monthlyIncome) return insights;

  const nowParts = getTzParts(new Date());
  const monthTxs = transactions.filter((tx) => {
    if (!tx.occurredAtISO) return false;
    const parts = getTzParts(new Date(tx.occurredAtISO));
    return parts.year === nowParts.year && parts.month === nowParts.month;
  });

  const totalExpense = monthTxs
    .filter((tx) => tx.type === "expense")
    .reduce((s, tx) => s + Number(tx.amount || 0), 0);

  const catTotals = groupByCategory(monthTxs);
  const daysElapsed = getDaysElapsed();
  const daysInMonth = getDaysInMonth();
  const daysRemaining = Math.max(1, daysInMonth - daysElapsed);

  // 1. Прогноз превышения бюджета
  if (recommendedSpend > 0 && totalExpense > 0) {
    const burnRate = totalExpense / daysElapsed;
    const projected = burnRate * daysInMonth;
    if (projected > recommendedSpend * 1.15) {
      const overAmount = Math.round(projected - recommendedSpend);
      insights.push({
        id: "budget-forecast",
        severity: "danger",
        Icon: Flame,
        text: `При таком темпе превысишь бюджет на ${formatAmount(overAmount)} к концу месяца`
      });
    }
  }

  // 2. Еда: более 35% дохода
  const foodTotal = FOOD_CATS.reduce((s, c) => s + (catTotals[c] || 0), 0);
  if (monthlyIncome > 0 && foodTotal > monthlyIncome * 0.35) {
    const pct = Math.round((foodTotal / monthlyIncome) * 100);
    insights.push({
      id: "food-overspend",
      severity: "warning",
      Icon: Utensils,
      text: `Еда составила ${pct}% дохода (норма ≈ 30%)`
    });
  }

  // 3. Транспорт: более 15% дохода
  const transportTotal = TRANSPORT_CATS.reduce((s, c) => s + (catTotals[c] || 0), 0);
  if (monthlyIncome > 0 && transportTotal > monthlyIncome * 0.15) {
    const pct = Math.round((transportTotal / monthlyIncome) * 100);
    insights.push({
      id: "transport-high",
      severity: "warning",
      Icon: Car,
      text: `Транспорт: ${pct}% дохода — выше нормы (15%)`
    });
  }

  // 4. Цель отстаёт
  if (activeGoal && activeGoal.manualTargetDateISO) {
    const target = new Date(`${activeGoal.manualTargetDateISO}T00:00:00`);
    const today = new Date();
    const createdMs = activeGoal.createdAt?.seconds
      ? activeGoal.createdAt.seconds * 1000
      : today.getTime();
    const totalDays = Math.max(1, (target - new Date(createdMs)) / 86400000);
    const elapsed = Math.max(0, (today - new Date(createdMs)) / 86400000);
    const timePct = elapsed / totalDays;
    const savedPct = activeGoal.targetAmount > 0
      ? (activeGoal.currentAmount || 0) / activeGoal.targetAmount
      : 0;
    if (savedPct < timePct * 0.7) {
      const needPerDay = Math.round(
        (activeGoal.targetAmount - (activeGoal.currentAmount || 0)) /
        Math.max(1, (target - today) / 86400000)
      );
      insights.push({
        id: "goal-behind",
        severity: "warning",
        Icon: Target,
        text: `Цель «${activeGoal.title}» отстаёт. Нужно ≈${formatAmount(needPerDay)}/день`
      });
    }
  }

  // 5. Укладываешься в бюджет
  if (recommendedSpend > 0 && totalExpense < recommendedSpend * 0.5 && daysElapsed >= 10) {
    const dailyRemaining = Math.round((recommendedSpend - totalExpense) / daysRemaining);
    insights.push({
      id: "on-track",
      severity: "success",
      Icon: CircleCheck,
      text: `Отлично! Остаток на день: ${formatAmount(dailyRemaining)}`
    });
  }

  // 6. Развлечения + покупки > 20%
  const funTotal = FUN_CATS.reduce((s, c) => s + (catTotals[c] || 0), 0);
  if (monthlyIncome > 0 && funTotal > monthlyIncome * 0.2) {
    insights.push({
      id: "fun-high",
      severity: "info",
      Icon: Theater,
      text: `Развлечения и покупки — ${Math.round((funTotal / monthlyIncome) * 100)}% дохода`
    });
  }

  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  return insights
    .sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4))
    .slice(0, 3);
}

export default function InsightsWidget({ transactions, monthlyIncome, recommendedSpend, activeGoal }) {
  const insights = useMemo(
    () => computeInsights({ transactions, monthlyIncome, recommendedSpend, activeGoal }),
    [transactions, monthlyIncome, recommendedSpend, activeGoal]
  );

  if (!insights.length) return null;

  return (
    <div className="insights-widget">
      {insights.map(({ id, severity, Icon, text }) => (
        <div key={id} className={`insight-item insight-item--${severity}`}>
          <span className="insight-icon">
            <Icon size={15} strokeWidth={2} />
          </span>
          <span className="insight-text">{text}</span>
        </div>
      ))}
    </div>
  );
}
