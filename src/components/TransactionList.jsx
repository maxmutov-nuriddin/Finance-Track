import { useMemo, useState } from "react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

export default function TransactionList({ items, onDelete }) {
  const { t } = useI18n();
  const categoryOptions = [
    { value: "all", label: t("categoryAll") },
    { value: "food", label: t("categoryFood") },
    { value: "transport", label: t("categoryTransport") },
    { value: "credit", label: t("categoryCredit") },
    { value: "rent", label: t("categoryRent") },
    { value: "health", label: t("categoryHealth") },
    { value: "other", label: t("categoryOther") }
  ];
  const typeOptions = [
    { value: "all", label: t("typeAll") },
    { value: "income", label: t("typeIncome") },
    { value: "expense", label: t("typeExpense") }
  ];

  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const categoryLabel = (key) => {
    if (key === "food") return t("categoryFood");
    if (key === "transport") return t("categoryTransport");
    if (key === "credit") return t("categoryCredit");
    if (key === "rent") return t("categoryRent");
    if (key === "health") return t("categoryHealth");
    return t("categoryOther");
  };

  const getCategoryIcon = (category) => {
    const icons = {
      food: "🍔",
      transport: "🚗",
      credit: "💳",
      rent: "🏠",
      health: "🏥",
      other: "📌"
    };
    return icons[category] || "📌";
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (type !== "all" && item.type !== type) return false;
      if (from && item.occurredAtISO?.slice(0, 10) < from) return false;
      if (to && item.occurredAtISO?.slice(0, 10) > to) return false;
      return true;
    });
  }, [items, category, type, from, to]);

  return (
    <div className="transaction-list-wrapper">
      <GlassCard>
        <div className="transaction-header">
          <div className="transaction-title">{t("allRecords")}</div>
          <div className="transaction-count">{filtered.length}</div>
        </div>

        <div className="transaction-filters">
          <div className="filter-group">
            <label className="filter-label">{t("categorySelect")}</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="filter-select"
            >
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t("typeLabel")}</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="filter-select"
            >
              {typeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">{t("dateLabel")} {t("from")}</label>
            <GlassInput
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">{t("dateLabel")} {t("to")}</label>
            <GlassInput
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>

        <div className="transactions-list">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div className="transaction-item" key={item.id}>
                <div className="transaction-item-left">
                  <div className="transaction-icon">{getCategoryIcon(item.category)}</div>
                  <div className="transaction-info">
                    <div className="transaction-description">
                      {item.description || item.raw || t("record")}
                    </div>
                    <div className="transaction-meta">
                      <span className="transaction-category">{categoryLabel(item.category)}</span>
                      <span className="transaction-date">
                        {new Date(item.occurredAtISO).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="transaction-item-right">
                  <div
                    className={`transaction-amount ${item.type === "income" ? "income" : "expense"}`}
                  >
                    {item.type === "income" ? "+" : "-"}
                    {formatAmount(item.amount || 0)}
                  </div>
                  <GlassButton
                    variant="ghost"
                    onClick={() => onDelete(item.id)}
                    className="transaction-delete"
                  >
                    ✕
                  </GlassButton>
                </div>
              </div>
            ))
          ) : (
            <div className="transaction-empty">
              <div className="empty-icon">📭</div>
              <div className="empty-text">{t("noRecords")}</div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
