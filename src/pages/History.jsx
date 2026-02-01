import { useEffect, useState } from "react";
import TransactionList from "../components/TransactionList";
import { useUser } from "../lib/user";
import { deleteTransaction, watchTransactions } from "../lib/store";

export default function History() {
  const user = useUser();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);

  return (
    <div className="stack">
      <div>
        <div className="card-title">Что ты записал</div>
        <div className="helper-text">
          Здесь все записи — просто список, без сложных форм.
        </div>
      </div>
      <TransactionList
        items={transactions}
        onDelete={(id) => deleteTransaction(user.uid, id)}
      />
    </div>
  );
}
