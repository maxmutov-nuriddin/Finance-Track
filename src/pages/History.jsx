import { useEffect, useState, useMemo } from "react";
import TransactionList from "../components/TransactionList";
import { useUser } from "../lib/user";
import { deleteTransaction, watchTransactions } from "../lib/store";
import { useI18n } from "../components/I18nProvider";
import { History as HistoryIcon } from "lucide-react";

export default function History() {
  const user = useUser();
  const { t } = useI18n();
  const [transactions, setTransactions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    if (!user) return;
    return watchTransactions(user.uid, setTransactions);
  }, [user]);

  const stats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { income, expense, total: transactions.length };
  }, [transactions]);

  return (
    <div className="history-container">
      <div className="history-header">
        <div>
          <h1 className="history-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <HistoryIcon size={28} strokeWidth={2.5} /> {t("historyTitle")}
          </h1>
          <p className="history-subtitle">{t("historyHelp")}</p>
        </div>
      </div>

      <div className="history-stats">
        <div className="stat-card income-card">
          <div className="stat-card-label">{t("typeIncome")}</div>
          <div className="stat-card-value" style={{ color: "#22c55e" }}>
            +{(stats.income || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card expense-card">
          <div className="stat-card-label">{t("typeExpense")}</div>
          <div className="stat-card-value" style={{ color: "#ef4444" }}>
            -{(stats.expense || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card total-card">
          <div className="stat-card-label">{t("allRecords")}</div>
          <div className="stat-card-value" style={{ color: "#3b82f6" }}>
            {stats.total}
          </div>
        </div>
      </div>

      <TransactionList
        items={transactions}
        onDelete={(id) => deleteTransaction(user.uid, id)}
      />
    </div>
  );
}
