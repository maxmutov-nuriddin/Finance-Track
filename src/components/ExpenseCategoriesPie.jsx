import { useMemo } from "react";
import { PieChart as PieChartRechart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "./I18nProvider";
import { formatAmount, formatCompact } from "../lib/format";
import { PieChart as PieChartIcon } from "lucide-react";

const CATEGORY_COLORS = {
  food: "#ef4444",
  cafe: "#f97316",
  groceries: "#22c55e",
  transport: "#f97316",
  clothes: "#f59e0b",
  beauty: "#ec4899",
  kids: "#a855f7",
  gifts: "#fb7185",
  pets: "#0ea5e9",
  travel: "#14b8a6",
  home: "#94a3b8",
  subscriptions: "#6366f1",
  taxes: "#475569",
  utilities: "#eab308",
  shopping: "#ec4899",
  entertainment: "#a855f7",
  health: "#06b6d4",
  education: "#3b82f6",
  personal: "#84cc16",
  credit: "#ef4444",
  debt: "#fb7185",
  rent: "#f59e0b",
  carryover: "#3b82f6",
  other: "#64748b"
};

const DEBT_WORDS = [
  "долг",
  "должен",
  "должна",
  "занял",
  "заняла",
  "занять",
  "одолжил",
  "одолжила",
  "одолжить",
  "займ",
  "займы",
  "qarz"
];

const CREDIT_WORDS = [
  "кредит",
  "рассрочка",
  "ипотека",
  "kredit"
];

const getEffectiveCategory = (tx) => {
  const base = tx?.category || "other";
  const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
  if (base === "debt") return "debt";
  if (base === "credit") {
    if (DEBT_WORDS.some((word) => text.includes(word))) return "debt";
    return "credit";
  }
  if (!tx?.category || base === "other") {
    if (DEBT_WORDS.some((word) => text.includes(word))) return "debt";
    if (CREDIT_WORDS.some((word) => text.includes(word))) return "credit";
  }
  return base;
};

const isDebtLendOrCollect = (tx) => {
  const mode = tx?.meta?.mode;
  if (tx?.meta?.kind === "debt" && (mode === "lend" || mode === "collect")) {
    return true;
  }
  if (tx?.type !== "expense") return false;
  if (tx?.category !== "debt") return false;
  const text = `${tx?.description || ""} ${tx?.raw || ""}`.toLowerCase();
  return /(дал|дала|одолжил|одолжила|lend|loaned|qarz\s*ber)/.test(text);
};

function ExpensePieTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="expense-pie-tooltip">
        <p className="expense-pie-tooltip-title">{data.name}</p>
        <p className="expense-pie-tooltip-value">
          {formatCompact(data.value)}
        </p>
      </div>
    );
  }
  return null;
}

export default function ExpenseCategoriesPie({ transactions = [] }) {
  const { t } = useI18n();

  const categoryData = useMemo(() => {
    const categories = Object.keys(CATEGORY_COLORS);
    const categoryMap = categories.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      if (isDebtLendOrCollect(tx)) return;
      const category = getEffectiveCategory(tx);
      if (!(category in categoryMap)) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += Number(tx.amount || 0);
    });

    return Object.entries(categoryMap)
      .map(([category, value]) => ({
        name: t(`category_${category}`) || category,
        value: Math.round(value),
        category
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, t]);

  const totalExpenses = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryData]);

  if (!categoryData || categoryData.length === 0 || totalExpenses <= 0) {
    return (
      <div className="expense-pie-card expense-pie-empty">
        <h2 className="expense-pie-title">
          <PieChartIcon size={24} strokeWidth={2.5} /> {t("expensesByCategory")}
        </h2>
        <p className="expense-pie-empty-text">
          {t("noData")}
        </p>
      </div>
    );
  }

  return (
    <div className="expense-pie-card">
      <div className="expense-pie-head">
        <h2 className="expense-pie-title">
          <PieChartIcon size={24} strokeWidth={2.5} /> {t("expensesByCategory")}
        </h2>
        <div className="expense-pie-total-label">
          {t("totalSpent")}
        </div>
        <div className="expense-pie-total-value">
          {formatAmount(Math.round(totalExpenses))}
        </div>
      </div>

      <div className="expense-pie-chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <PieChartRechart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent }) => (percent >= 0.035 ? `${Math.max(1, Math.round(percent * 100))}%` : "")}
              outerRadius={86}
              innerRadius={46}
              fill="#8884d8"
              dataKey="value"
              startAngle={90}
              endAngle={450}
              paddingAngle={3}
              minAngle={2}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other}
                />
              ))}
            </Pie>
            <Tooltip content={<ExpensePieTooltip />} cursor={{ fill: "transparent" }} />
          </PieChartRechart>
        </ResponsiveContainer>
      </div>

      <div className="expense-pie-legend-grid">
        {categoryData.map((item) => {
          const percent = totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;
          return (
            <div key={`summary-${item.category}`} className="expense-pie-legend-item">
              <div className="expense-pie-legend-top">
                <span
                  className="expense-pie-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other }}
                />
                <span className="expense-pie-legend-name">{item.name}</span>
                <span className="expense-pie-legend-percent">{percent}%</span>
              </div>
              <div className="expense-pie-legend-value">
                {formatAmount(Math.round(item.value))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
