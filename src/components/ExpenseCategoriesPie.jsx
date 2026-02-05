import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "./I18nProvider";
import { formatAmount } from "../lib/format";

const CATEGORY_COLORS = {
  food: "#ef4444",
  transport: "#f97316",
  utilities: "#eab308",
  shopping: "#ec4899",
  entertainment: "#a855f7",
  health: "#06b6d4",
  education: "#3b82f6",
  personal: "#84cc16",
  credit: "#ef4444",
  other: "#64748b"
};

export default function ExpenseCategoriesPie({ transactions = [] }) {
  const { t } = useI18n();

  const categoryData = useMemo(() => {
    const categoryMap = {};
    
    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const category = tx.category || "other";
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += Number(tx.amount || 0);
    });

    const data = Object.entries(categoryMap)
      .map(([category, value]) => ({
        name: t(`category_${category}`) || category,
        value: Math.round(value),
        category
      }))
      .sort((a, b) => b.value - a.value);

    return data;
  }, [transactions, t]);

  const totalExpenses = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryData]);

  if (!categoryData || categoryData.length === 0) {
    return (
      <div style={{ background: "#1a202c", border: "1px solid #404854", borderRadius: "20px", padding: "28px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0, color: "#ffffff", marginBottom: "12px" }}>
          📊 {t("expensesByCategory")}
        </h2>
        <p style={{ marginTop: "12px", color: "#a0aec0" }}>
          {t("noData")}
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          background: "#1a202c",
          border: "1px solid #404854",
          borderRadius: "8px",
          padding: "10px 12px",
          color: "#ffffff",
          fontSize: "0.9rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
        }}>
          <p style={{ margin: 0, fontWeight: "600" }}>{data.name}</p>
          <p style={{ margin: "4px 0 0 0", color: "#2f6bff", fontWeight: "700" }}>
            {formatAmount(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ background: "#1a202c", border: "1px solid #404854", borderRadius: "20px", padding: "28px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0, color: "#ffffff", marginBottom: "12px" }}>
          💰 {t("expensesByCategory")}
        </h2>
        <div style={{ fontSize: "0.875rem", color: "#a0aec0" }}>
          {t("totalSpent")}: <span style={{ color: "#ffffff", fontWeight: "600" }}>{formatAmount(Math.round(totalExpenses))}</span>
        </div>
      </div>

      <div style={{ marginBottom: "24px", flex: 1, display: "flex", alignItems: "center" }}>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              startAngle={90}
              endAngle={450}
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
        {categoryData.slice(0, 4).map((item) => (
          <div key={`summary-${item.category}`} style={{ paddingBottom: "12px", borderBottom: "1px solid rgba(64, 72, 84, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other
                }}
              />
              <span style={{ fontSize: "0.9rem", color: "#ffffff", fontWeight: "500" }}>
                {item.name}
              </span>
            </div>
            <div style={{ fontSize: "1.125rem", fontWeight: "700", color: "#ffffff", marginLeft: "16px" }}>
              {formatAmount(Math.round(item.value))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
