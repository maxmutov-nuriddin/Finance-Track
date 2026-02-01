import { useMemo } from "react";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import { formatAmount } from "../lib/format";

export default function PaymentsOverview({ payments }) {
  const upcomingAlertDateISO = useMemo(() => {
    const base = makeTashkentDate(getTzParts(new Date()));
    const parts = addDaysInTz(base, 3);
    return formatDateISO(parts);
  }, []);

  const upcoming = useMemo(
    () => payments.filter((pay) => pay.payDateISO >= upcomingAlertDateISO).slice(0, 3),
    [payments, upcomingAlertDateISO]
  );

  return (
    <GlassCard>
      <div className="card-title">Ближайшие платежи</div>
      <div className="helper-text">Мы напомним за 3 дня.</div>
      <div className="list" style={{ marginTop: 12 }}>
        {upcoming.map((payment) => (
          <div className="list-item" key={payment.id}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
            </div>
            <span className="badge">{formatAmount(payment.amount)}</span>
          </div>
        ))}
        {!upcoming.length && <div className="muted">Пока нет платежей.</div>}
      </div>
    </GlassCard>
  );
}
