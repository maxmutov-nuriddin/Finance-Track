import { useEffect, useState, useMemo } from "react";
import PaymentsPanel from "../components/PaymentsPanel";
import { useUser } from "../lib/user";
import { deletePayment, watchPayments, watchTransactions } from "../lib/store";
import { useI18n } from "../components/I18nProvider";
import { formatAmount } from "../lib/format";

export default function Payments() {
  const user = useUser();
  const { t } = useI18n();
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchPayments(user.uid, setPayments);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);

  const stats = useMemo(() => {
    const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const monthly = payments.filter(p => p.recurrence === "monthly").length;
    return { total, monthly };
  }, [payments]);

  return (
    <div className="payments-container">
      <div className="payments-header">
        <div>
          <h1 className="payments-title">{t("monthlyPayments")}</h1>
          <p className="payments-subtitle">{t("remind3days")}</p>
        </div>
      </div>

      <div className="payments-stats">
        <div className="stat-card">
          <div className="stat-card-label">{t("allPayments")}</div>
          <div className="stat-card-value" style={{ color: "#3b82f6" }}>
            {payments.length}
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
        uid={user.uid}
        payments={payments}
        transactions={transactions}
        onDelete={(id) => deletePayment(user.uid, id)}
      />
    </div>
  );
}
