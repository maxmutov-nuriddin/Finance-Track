import { useMemo } from "react";
import GlassCard from "./GlassCard";
import { useI18n } from "./I18nProvider";

const CATEGORY_COLORS = {
  food: "#ef4444",      // Red - пища
  transport: "#f97316",  // Orange - транспорт
  utilities: "#eab308",  // Yellow - коммунальные
  shopping: "#ec4899",   // Pink - покупки
  entertainment: "#a855f7", // Purple - развлечения
  health: "#06b6d4",    // Cyan - здоровье
  education: "#3b82f6", // Blue - образование
  personal: "#84cc16",   // Lime - личное
  credit: "#ef4444",     // Red - кредит
  other: "#64748b"       // Slate - другое
};

export default function ExpenseCategoriesPie({ transactions = [] }) {
  const { t } = useI18n();

  const categoryData = useMemo(() => {
    const categoryMap = {};
    
    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const category = tx.category || "other";
      categoryMap[category] = (categoryMap[category] || 0) + Number(tx.amount || 0);
    });

    const sortedData = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: 0,
        label: t(`category_${category}`) || category
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = sortedData.reduce((sum, item) => sum + item.amount, 0);
    
    return sortedData.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0
    }));
  }, [transactions, t]);

  const topCategories = useMemo(() => {
    return categoryData.slice(0, 4);
  }, [categoryData]);

  const drawPie = useMemo(() => {
    if (categoryData.length === 0) return null;

    const size = 180;
    const radius = 70;
    let currentAngle = -90;

    const segments = categoryData.map((item) => {
      const sliceAngle = (item.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = size / 2 + radius * Math.cos(startRad);
      const y1 = size / 2 + radius * Math.sin(startRad);
      const x2 = size / 2 + radius * Math.cos(endRad);
      const y2 = size / 2 + radius * Math.sin(endRad);
      
      const largeArc = sliceAngle > 180 ? 1 : 0;
      
      const path = `M ${size / 2} ${size / 2} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      currentAngle = endAngle;
      
      return {
        path,
        color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other,
        category: item.category,
        percentage: item.percentage
      };
    });

    return segments;
  }, [categoryData]);

  if (categoryData.length === 0) {
    return (
      <GlassCard>
        <h3 className="card-title">📊 {t("expenses")}</h3>
        <p className="card-hint" style={{ marginTop: "12px", color: "#a0aec0" }}>
          {t("noData")}
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="pie-header">
        <h3 className="card-title">📊 {t("expensesByCategory")}</h3>
      </div>

      <div className="pie-container">
        <div className="pie-chart-wrapper">
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2))" }}>
            {drawPie && drawPie.map((segment, index) => (
              <path
                key={index}
                d={segment.path}
                fill={segment.color}
                opacity="0.9"
                style={{ transition: "opacity 0.2s ease" }}
              />
            ))}
          </svg>
        </div>

        <div className="pie-legend">
          {topCategories.map((item) => (
            <div key={item.category} className="legend-item">
              <div 
                className="legend-dot" 
                style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other }}
              />
              <div className="legend-content">
                <div className="legend-label">{item.label}</div>
                <div className="legend-value">{item.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
