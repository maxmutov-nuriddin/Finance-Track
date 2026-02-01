import GlassCard from "./GlassCard";
import StatsChart from "./StatsChart";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function StatsCard({ stats, periodLabel = "За текущий месяц", monthlyNet, series }) {
  const { t } = useI18n();
  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("moneyNow")}</div>
          <div className="muted">{periodLabel}</div>
        </div>
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
      <div style={{ marginTop: 16 }}>
        <StatsChart series={series} />
      </div>
    </GlassCard>
  );
}