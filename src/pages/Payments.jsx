import { useEffect, useState } from "react";
import PaymentsPanel from "../components/PaymentsPanel";
import { useUser } from "../lib/user";
import { addPayment, deletePayment, watchPayments } from "../lib/store";

export default function Payments() {
  const user = useUser();
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchPayments(user.uid, setPayments);
  }, [user]);

  return (
    <div className="stack">
      <div>
        <div className="card-title">Обязательные платежи</div>
        <div className="helper-text">
          Добавь платеж, и мы напомним за 3 дня.
        </div>
      </div>
      <PaymentsPanel
        uid={user.uid}
        payments={payments}
        onAdd={(payload) => addPayment(user.uid, payload)}
        onDelete={(id) => deletePayment(user.uid, id)}
      />
    </div>
  );
}
