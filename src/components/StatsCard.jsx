import GlassCard from "./GlassCard";
import StatsChart from "./StatsChart";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function StatsCard({
  stats,
  periodLabel = "За текущий месяц",
  monthlyNet,
  series,
  dailyLimit,
  dailyRemaining,
  daysInMonth,
  range,
  onRangeChange
}) {
  const { t } = useI18n();
  return (
    <div style={{ background: "#1a202c", border: "1px solid #404854", borderRadius: "20px", padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0, color: "#ffffff", marginBottom: "12px" }}>
            {t("moneyNow")}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4b7bff" }}></div>
              <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Higher</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3a4556" }}></div>
              <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Lower</span>
            </div>
          </div>
        </div>
        {onRangeChange && (
          <div className="pill-tabs">
            <button
              type="button"
              className={`pill-tab ${range === "day" ? "pill-tab-active" : ""}`}
              onClick={() => onRangeChange("day")}
            >
              {t("rangeDay")}
            </button>
            <button
              type="button"
              className={`pill-tab ${range === "week" ? "pill-tab-active" : ""}`}
              onClick={() => onRangeChange("week")}
            >
              {t("rangeWeek")}
            </button>
            <button
              type="button"
              className={`pill-tab ${range === "month" ? "pill-tab-active" : ""}`}
              onClick={() => onRangeChange("month")}
            >
              {t("rangeMonth")}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "24px" }}>
        <StatsChart series={series} targetValue={dailyLimit} formatValue={formatAmount} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }}>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "8px" }}>
            {t("came")}
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#ffffff" }}>
            {formatAmount(stats.income)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "8px" }}>
            {t("spent")}
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#ffffff" }}>
            {formatAmount(stats.expense)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "8px" }}>
            {t("left")}
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#ffffff" }}>
            {formatAmount(stats.net)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #404854" }}>
        <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "8px" }}>
          {t("monthFact")}: {formatAmount(Math.round(monthlyNet))}.
        </div>
        {Number.isFinite(dailyLimit) && Number.isFinite(daysInMonth) && (
          <div style={{ fontSize: "0.875rem", color: "#a0aec0", marginBottom: "4px" }}>
            {t("dailyLimitLabel", { days: daysInMonth })}: {formatAmount(Math.round(dailyLimit))}.
          </div>
        )}
        {Number.isFinite(dailyRemaining) && (
          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            {t("dailyRemainingLabel")}: {formatAmount(Math.round(dailyRemaining))}.
          </div>
        )}
      </div>
    </div>
  );
}
