import { useMemo } from "react";
import { CalendarDays, Clock3, Repeat2, Trash2 } from "lucide-react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function PaymentsPanel({ payments, transactions = [], onDelete }) {
  const { t } = useI18n();
  const recurringFromTransactions = useMemo(() => {
    return (transactions || [])
      .filter((tx) => tx?.isRecurring && tx.type === "expense")
      .slice(0, 100);
  }, [transactions]);
  const usingTransactionFallback = payments.length === 0;
  const recurringVisible = usingTransactionFallback ? recurringFromTransactions : [];
  const recordsCount = usingTransactionFallback ? recurringVisible.length : payments.length;

  return (
    <GlassCard className="payments-panel">
      <div className="payments-list-header">
        <div className="payments-list-title">{t("paymentsTitle")}</div>
        <div className="payments-badge">{recordsCount}</div>
      </div>

      <div className="payments-items">
        <div className="payments-section">
          <div className="payments-section-title">{t("allRecords")}</div>
          <div className="payment-list">
            {recurringVisible.map((tx) => (
              <div className="payment-item" key={`rtx-${tx.id}`}>
                <div className="payment-item-left">
                  <div className="payment-icon payment-icon--recurring">
                    <Repeat2 size={16} strokeWidth={2} />
                  </div>
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
                  <div className={`payment-icon ${payment.recurrence === "monthly" ? "payment-icon--monthly" : "payment-icon--onetime"}`}>
                    {payment.recurrence === "monthly"
                      ? <CalendarDays size={16} strokeWidth={2} />
                      : <Clock3 size={16} strokeWidth={2} />
                    }
                  </div>
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
                    aria-label={t("deleteConfirm")}
                  >
                    <Trash2 size={14} strokeWidth={2} />
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
