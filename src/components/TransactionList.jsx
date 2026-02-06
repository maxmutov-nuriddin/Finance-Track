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
    { value: "cafe", label: t("categoryCafe") },
    { value: "groceries", label: t("categoryGroceries") },
    { value: "food", label: t("categoryFood") },
    { value: "transport", label: t("categoryTransport") },
    { value: "clothes", label: t("categoryClothes") },
    { value: "beauty", label: t("categoryBeauty") },
    { value: "kids", label: t("categoryKids") },
    { value: "gifts", label: t("categoryGifts") },
    { value: "pets", label: t("categoryPets") },
    { value: "travel", label: t("categoryTravel") },
    { value: "home", label: t("categoryHome") },
    { value: "subscriptions", label: t("categorySubscriptions") },
    { value: "taxes", label: t("categoryTaxes") },
    { value: "utilities", label: t("categoryUtilities") },
    { value: "shopping", label: t("categoryShopping") },
    { value: "entertainment", label: t("categoryEntertainment") },
    { value: "education", label: t("categoryEducation") },
    { value: "personal", label: t("categoryPersonal") },
    { value: "credit", label: t("categoryCredit") },
    { value: "debt", label: t("categoryDebt") },
    { value: "rent", label: t("categoryRent") },
    { value: "health", label: t("categoryHealth") },
    { value: "carryover", label: t("categoryCarryover") },
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
    if (key === "cafe") return t("categoryCafe");
    if (key === "groceries") return t("categoryGroceries");
    if (key === "food") return t("categoryFood");
    if (key === "transport") return t("categoryTransport");
    if (key === "clothes") return t("categoryClothes");
    if (key === "beauty") return t("categoryBeauty");
    if (key === "kids") return t("categoryKids");
    if (key === "gifts") return t("categoryGifts");
    if (key === "pets") return t("categoryPets");
    if (key === "travel") return t("categoryTravel");
    if (key === "home") return t("categoryHome");
    if (key === "subscriptions") return t("categorySubscriptions");
    if (key === "taxes") return t("categoryTaxes");
    if (key === "utilities") return t("categoryUtilities");
    if (key === "shopping") return t("categoryShopping");
    if (key === "entertainment") return t("categoryEntertainment");
    if (key === "education") return t("categoryEducation");
    if (key === "personal") return t("categoryPersonal");
    if (key === "credit") return t("categoryCredit");
    if (key === "debt") return t("categoryDebt");
    if (key === "rent") return t("categoryRent");
    if (key === "health") return t("categoryHealth");
    if (key === "carryover") return t("categoryCarryover");
    return t("categoryOther");
  };

  const getCategoryIcon = (category) => {
    const icons = {
      cafe: "☕",
      groceries: "🛒",
      food: "🍔",
      transport: "🚗",
      clothes: "👕",
      beauty: "💄",
      kids: "🧸",
      gifts: "🎁",
      pets: "🐾",
      travel: "✈️",
      home: "🏠",
      subscriptions: "🔔",
      taxes: "🧾",
      utilities: "💡",
      shopping: "🛍️",
      entertainment: "🎬",
      education: "🎓",
      personal: "🙂",
      credit: "💳",
      debt: "🧾",
      rent: "🏠",
      health: "🏥",
      carryover: "🔁",
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
