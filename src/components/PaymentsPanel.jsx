import { useMemo, useState } from "react";
import { enableNotifications, getNotificationStatus } from "../lib/notifications";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function PaymentsPanel({ uid, payments, transactions = [], onDelete }) {
  const { t } = useI18n();
  const [notificationStatus, setNotificationStatus] = useState(getNotificationStatus());

  const upcomingAlertDateISO = useMemo(() => {
    const base = makeTashkentDate(getTzParts(new Date()));
    const parts = addDaysInTz(base, 3);
    return formatDateISO(parts);
  }, []);

  const upcoming = useMemo(
    () => payments.filter((pay) => pay.payDateISO === upcomingAlertDateISO),
    [payments, upcomingAlertDateISO]
  );
  const recurringFromTransactions = useMemo(() => {
    return (transactions || [])
      .filter((tx) => tx?.isRecurring && tx.type === "expense")
      .slice(0, 5);
  }, [transactions]);

  const handleEnableNotifications = async () => {
    const result = await enableNotifications(uid);
    setNotificationStatus(result.status === "enabled" ? "granted" : result.status);
  };

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("paymentsTitle")}</div>
          <div className="muted">{t("paymentsHelp")}</div>
        </div>
      </div>

      {notificationStatus !== "granted" ? (
        <div className="alert" style={{ marginTop: 12 }}>
          {t("notificationsOff")}
          <div style={{ marginTop: 8 }}>
            <GlassButton variant="secondary" onClick={handleEnableNotifications}>
              {t("enableNotifications")}
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="alert" style={{ marginTop: 12 }}>
          {t("notificationsOn")}
        </div>
      )}

      <div className="list" style={{ marginTop: 14 }}>
        {recurringFromTransactions.map((tx) => (
          <div className="list-item" key={`rtx-${tx.id}`}>
            <div className="list-item-meta">
              <strong>{tx.description || t("monthlyExpense")}</strong>
              <span className="muted">{tx.occurredAtISO?.slice(0, 10)}</span>
              <span className="badge">{t("monthlyInBudget")}</span>
            </div>
            <div className="row">
              <span className="badge">{formatAmount(tx.amount)}</span>
            </div>
          </div>
        ))}
        {payments.map((payment) => (
          <div className="list-item" key={payment.id}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
              {payment.recurrence === "monthly" ? (
                <span className="badge">{t("monthlyInBudget")}</span>
              ) : (
                <span className="badge">{t("oneTimeNotBudget")}</span>
              )}
            </div>
            <div className="row">
              <span className="badge">{formatAmount(payment.amount)}</span>
              <GlassButton variant="ghost" onClick={() => onDelete(payment.id)}>
                {t("delete")}
              </GlassButton>
            </div>
          </div>
        ))}
        {!payments.length && recurringFromTransactions.length === 0 && (
          <div className="muted">{t("noPaymentsYet")}</div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="card-title">{t("in3days")}</div>
          <div className="list">
            {upcoming.map((payment) => (
              <div className="list-item" key={`up-${payment.id}`}>
                <div className="list-item-meta">
                  <strong>{payment.title}</strong>
                  <span className="muted">{formatAmount(payment.amount)}</span>
                </div>
                <span className="badge">{payment.payDateISO}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </GlassCard>
  );
}
