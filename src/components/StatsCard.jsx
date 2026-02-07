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
  isSalaryHorizon = false,
  range,
  onRangeChange
}) {
  const { t } = useI18n();
  return (
    <div className="stats-card">
      <div className="stats-card-header">
        <div className="stats-card-title-block">
          <h2 className="stats-card-title">{t("moneyNow")}</h2>
          <div className="stats-card-legend">
            <div className="stats-card-legend-item">
              <span className="stats-card-legend-dot stats-card-legend-high" />
              <span className="stats-card-legend-label">Higher</span>
            </div>
            <div className="stats-card-legend-item">
              <span className="stats-card-legend-dot stats-card-legend-low" />
              <span className="stats-card-legend-label">Lower</span>
            </div>
          </div>
        </div>
        {onRangeChange && (
          <div className="pill-tabs stats-card-tabs">
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

      <div className="stats-card-chart">
        <StatsChart series={series} targetValue={dailyLimit} formatValue={formatAmount} />
      </div>

      <div className="stats-card-summary">
        <div className="stats-card-metric">
          <div className="stats-card-metric-label">{t("came")}</div>
          <div className="stats-card-metric-value">{formatAmount(stats.income)}</div>
        </div>
        <div className="stats-card-metric">
          <div className="stats-card-metric-label">{t("spent")}</div>
          <div className="stats-card-metric-value">{formatAmount(stats.expense)}</div>
        </div>
        <div className="stats-card-metric">
          <div className="stats-card-metric-label">{t("left")}</div>
          <div className="stats-card-metric-value">{formatAmount(stats.net)}</div>
        </div>
      </div>

      <div className="stats-card-foot">
        <div className="stats-card-foot-row">
          {t("monthFact")}: {formatAmount(Math.round(monthlyNet))}.
        </div>
        {Number.isFinite(dailyLimit) && Number.isFinite(daysInMonth) && (
          <div className="stats-card-foot-row">
            {isSalaryHorizon
              ? t("dailyLimitToSalaryLabel")
              : t("dailyLimitLabel", { days: daysInMonth })}: {formatAmount(Math.round(dailyLimit))}.
          </div>
        )}
        {Number.isFinite(dailyRemaining) && (
          <div className="stats-card-foot-row stats-card-foot-muted">
            {t("dailyRemainingLabel")}: {formatAmount(Math.round(dailyRemaining))}.
          </div>
        )}
      </div>
    </div>
  );
}
