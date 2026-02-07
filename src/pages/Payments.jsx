import { useEffect, useState, useMemo } from "react";
import PaymentsPanel from "../components/PaymentsPanel";
import { useUser } from "../lib/user";
import { deletePayment, watchPayments, watchSettings, watchTransactions } from "../lib/store";
import { useI18n } from "../components/I18nProvider";
import { formatAmount } from "../lib/format";
import { CreditCard } from "lucide-react";

export default function Payments() {
  const user = useUser();
  const { t } = useI18n();
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!user) return;
    return watchPayments(user.uid, setPayments);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return watchSettings(user.uid, setSettings);
  }, [user]);

  const stats = useMemo(() => {
    const fallbackRecurring = (transactions || []).filter(
      (tx) => tx?.isRecurring && tx.type === "expense"
    );
    const useFallback = payments.length === 0;

    if (useFallback) {
      const total = fallbackRecurring.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return { total, monthly: fallbackRecurring.length, count: fallbackRecurring.length };
    }

    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const monthly = payments.filter((p) => p.recurrence === "monthly").length;
    return { total, monthly, count: payments.length };
  }, [payments, transactions]);
  const remindersEnabled = Boolean(settings?.remindersEnabled);

  return (
    <div className="payments-container">
      <div className="payments-header">
        <div>
          <h1 className="payments-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CreditCard size={28} strokeWidth={2.5} /> {t("monthlyPayments")}
          </h1>
          <p className="payments-subtitle">
            {remindersEnabled ? t("remind3days") : t("allRemindersOff")}
          </p>
        </div>
      </div>

      <div className="payments-stats">
        <div className="stat-card">
          <div className="stat-card-label">{t("allPayments")}</div>
          <div className="stat-card-value" style={{ color: "#3b82f6" }}>
            {stats.count}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t("monthlyInBudget")}</div>
          <div className="stat-card-value" style={{ color: "#22c55e" }}>
            {stats.monthly}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">{t("totalAmount")}</div>
          <div className="stat-card-value" style={{ color: "#f97316" }}>
            {formatAmount(stats.total)}
          </div>
        </div>
      </div>

      <PaymentsPanel
        payments={payments}
        transactions={transactions}
        allRemindersEnabled={Boolean(settings?.remindersEnabled)}
        onDelete={async (id) => {
          if (!user) return;
          const confirmed = window.confirm(t("deleteConfirm"));
          if (!confirmed) return;
          await deletePayment(user.uid, id);
        }}
      />
    </div>
  );
}
