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
    <GlassCard>
      <div className="card-title">{t("allRecords")}</div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categoryOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {typeOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <GlassInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <GlassInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div className="list">
        {filtered.map((item) => (
          <div className="list-item" key={item.id}>
            <div className="list-item-meta">
              <strong>{item.description || item.raw || t("record")}</strong>
              <span className="muted">
                {item.type === "income" ? t("typeIncome") : t("typeExpense")} • {categoryLabel(item.category)}
              </span>
              <span className="muted">{item.occurredAtISO}</span>
            </div>
            <div className="row">
              <span className="badge">{formatAmount(item.amount || 0)}</span>
              <GlassButton variant="ghost" onClick={() => onDelete(item.id)}>
                {t("delete")}
              </GlassButton>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="muted">{t("noRecords")}</div>}
      </div>
    </GlassCard>
  );
}
