import { useEffect, useState } from "react";
import PaymentsPanel from "../components/PaymentsPanel";
import { useUser } from "../lib/user";
import { deletePayment, watchPayments, watchTransactions } from "../lib/store";
import { useI18n } from "../components/I18nProvider";

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

  return (
    <div className="stack">
      <div>
        <div className="card-title">{t("monthlyPayments")}</div>
        <div className="helper-text">{t("remind3days")}</div>
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
