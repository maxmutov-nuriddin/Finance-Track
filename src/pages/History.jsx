import { useEffect, useState } from "react";
import TransactionList from "../components/TransactionList";
import { useUser } from "../lib/user";
import { deleteTransaction, watchTransactions } from "../lib/store";
import { useI18n } from "../components/I18nProvider";

export default function History() {
  const user = useUser();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);

  return (
    <div className="stack">
      <div>
        <div className="card-title">{t("historyTitle")}</div>
        <div className="helper-text">{t("historyHelp")}</div>
      </div>
      <TransactionList
        items={transactions}
        onDelete={(id) => deleteTransaction(user.uid, id)}
      />
    </div>
  );
}
