import { useMemo } from "react";
import { getNotificationStatus } from "../lib/notifications";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function PaymentsPanel({ payments, transactions = [], allRemindersEnabled = false, onDelete }) {
  const { t } = useI18n();
  const notificationStatus = getNotificationStatus();
  const remindersReady = allRemindersEnabled && notificationStatus === "granted";

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
      .slice(0, 100);
  }, [transactions]);
  const usingTransactionFallback = payments.length === 0;
  const recurringVisible = usingTransactionFallback ? recurringFromTransactions : [];
  const recordsCount = usingTransactionFallback ? recurringVisible.length : payments.length;

  return (
    <GlassCard>
      <div className="payments-list-header">
        <div className="payments-list-title">{t("paymentsTitle")}</div>
        <div className="payments-badge">{recordsCount}</div>
      </div>

      {!remindersReady ? (
        <div className="alert" style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            {notificationStatus === "unsupported"
              ? t("allRemindersUnsupported")
              : notificationStatus === "denied"
                ? t("allRemindersDenied")
                : t("notificationsManagedInSettings")}
          </div>
          <div className="helper-text">{t("allRemindersOff")}</div>
        </div>
      ) : (
        <div className="alert" style={{ marginBottom: 20 }}>
          ✓ {t("notificationsOn")}
        </div>
      )}

      <div className="payments-items">
        {upcoming.length > 0 && (
          <div className="upcoming-payments">
            <div className="upcoming-title">⏰ {t("in3days")}</div>
            <div className="upcoming-list">
              {upcoming.map((payment) => (
                <div className="upcoming-item" key={`up-${payment.id}`}>
                  <div className="upcoming-info">
                    <div className="upcoming-name">{payment.title}</div>
                    <div className="upcoming-date">{payment.payDateISO}</div>
                  </div>
                  <div className="upcoming-amount">{formatAmount(payment.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="payments-section">
          <div className="payments-section-title">📋 {t("allRecords")}</div>
          <div className="payment-list">
            {recurringVisible.map((tx) => (
              <div className="payment-item" key={`rtx-${tx.id}`}>
                <div className="payment-item-left">
                  <div className="payment-icon">🔄</div>
                  <div className="payment-info">
                    <div className="payment-name">{tx.description || t("monthlyExpense")}</div>
                    <div className="payment-meta">
                      <span className="payment-category">{t("monthlyInBudget")}</span>
                      <span className="payment-date">{tx.occurredAtISO?.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
                <div className="payment-amount">{formatAmount(tx.amount)}</div>
              </div>
            ))}
            {payments.map((payment) => (
              <div className="payment-item" key={payment.id}>
                <div className="payment-item-left">
                  <div className="payment-icon">{payment.recurrence === "monthly" ? "📅" : "⏱️"}</div>
                  <div className="payment-info">
                    <div className="payment-name">{payment.title}</div>
                    <div className="payment-meta">
                      <span className={`payment-category ${payment.recurrence === "monthly" ? "monthly" : "onetime"}`}>
                        {payment.recurrence === "monthly" ? t("monthlyInBudget") : t("oneTimeNotBudget")}
                      </span>
                      <span className="payment-date">{payment.payDateISO}</span>
                    </div>
                  </div>
                </div>
                <div className="payment-item-right">
                  <div className="payment-amount">{formatAmount(payment.amount)}</div>
                  <GlassButton
                    variant="ghost"
                    onClick={() => onDelete(payment.id)}
                    className="payment-delete-btn"
                  >
                    ✕
                  </GlassButton>
                </div>
              </div>
            ))}
            {!payments.length && recurringVisible.length === 0 && (
              <div className="payments-empty">
                <div className="empty-icon">💳</div>
                <div className="empty-text">{t("noPaymentsYet")}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
