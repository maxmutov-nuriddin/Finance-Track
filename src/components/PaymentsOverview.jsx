import { useMemo } from "react";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function PaymentsOverview({ payments }) {
  const { t } = useI18n();
  const upcomingAlertDateISO = useMemo(() => {
    const base = makeTashkentDate(getTzParts(new Date()));
    const parts = addDaysInTz(base, 3);
    return formatDateISO(parts);
  }, []);

  const upcoming = useMemo(
    () => payments.filter((pay) => pay.payDateISO >= upcomingAlertDateISO).slice(0, 3),
    [payments, upcomingAlertDateISO]
  );
  const monthly = useMemo(
    () => payments.filter((pay) => (pay.recurrence || "oneTime") === "monthly"),
    [payments]
  );

  return (
    <GlassCard>
      <div className="card-title">{t("upcomingPayments")}</div>
      <div className="helper-text">{t("remind3days")}</div>
      <div className="list" style={{ marginTop: 12 }}>
        {monthly.map((payment) => (
          <div className="list-item" key={`m-${payment.id}`}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
              <span className="badge">{t("monthlyInBudget")}</span>
            </div>
            <span className="badge">{formatAmount(payment.amount)}</span>
          </div>
        ))}
        {upcoming.map((payment) => (
          <div className="list-item" key={payment.id}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
            </div>
            <span className="badge">{formatAmount(payment.amount)}</span>
          </div>
        ))}
        {!upcoming.length && !monthly.length && <div className="muted">{t("noPayments")}</div>}
      </div>
    </GlassCard>
  );
}
