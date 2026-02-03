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
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("moneyNow")}</div>
          <div className="muted">{periodLabel}</div>
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
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <span className="muted">{t("came")}</span>
          <span className="stat-value">{formatAmount(stats.income)}</span>
        </div>
        <div className="stat">
          <span className="muted">{t("spent")}</span>
          <span className="stat-value">{formatAmount(stats.expense)}</span>
        </div>
        <div className="stat">
          <span className="muted">{t("left")}</span>
          <span className="stat-value">{formatAmount(stats.net)}</span>
        </div>
      </div>
      <div className="helper-text" style={{ marginTop: 10 }}>
        {t("monthFact")}: {formatAmount(Math.round(monthlyNet))}.
      </div>
      {Number.isFinite(dailyLimit) && Number.isFinite(daysInMonth) && (
        <div className="helper-text" style={{ marginTop: 6 }}>
          {t("dailyLimitLabel", { days: daysInMonth })}: {formatAmount(Math.round(dailyLimit))}.
        </div>
      )}
      {Number.isFinite(dailyRemaining) && (
        <div className="helper-text" style={{ marginTop: 4 }}>
          {t("dailyRemainingLabel")}: {formatAmount(Math.round(dailyRemaining))}.
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <StatsChart series={series} targetValue={dailyLimit} formatValue={formatAmount} />
      </div>
    </GlassCard>
  );
}
