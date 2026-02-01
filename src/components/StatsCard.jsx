import GlassCard from "./GlassCard";
import StatsChart from "./StatsChart";
import { formatAmount } from "../lib/format";

export default function StatsCard({ stats, periodLabel = "За текущий месяц", monthlyNet, series }) {
  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">Что сейчас происходит с деньгами</div>
          <div className="muted">{periodLabel}</div>
        </div>
      </div>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <span className="muted">Пришло</span>
          <span className="stat-value">{formatAmount(stats.income)}</span>
        </div>
        <div className="stat">
          <span className="muted">Потрачено</span>
          <span className="stat-value">{formatAmount(stats.expense)}</span>
        </div>
        <div className="stat">
          <span className="muted">Остается</span>
          <span className="stat-value">{formatAmount(stats.net)}</span>
        </div>
      </div>
      <div className="helper-text" style={{ marginTop: 10 }}>
        Факт за месяц: {formatAmount(Math.round(monthlyNet))}.
      </div>
      <div style={{ marginTop: 16 }}>
        <StatsChart series={series} />
      </div>
    </GlassCard>
  );
}
