import { useMemo, useState } from "react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";

const categoryOptions = [
  { value: "all", label: "Все" },
  { value: "food", label: "Еда" },
  { value: "transport", label: "Транспорт" },
  { value: "credit", label: "Кредит" },
  { value: "rent", label: "Аренда" },
  { value: "health", label: "Здоровье" },
  { value: "other", label: "Другое" }
];
const typeOptions = [
  { value: "all", label: "Все" },
  { value: "income", label: "Доход" },
  { value: "expense", label: "Расход" }
];

export default function TransactionList({ items, onDelete }) {
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
      <div className="card-title">Все записи</div>
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
              <strong>{item.description || item.raw || "Запись"}</strong>
              <span className="muted">
                {item.type === "income" ? "Доход" : "Расход"} • {item.category}
              </span>
              <span className="muted">{item.occurredAtISO}</span>
            </div>
            <div className="row">
              <span className="badge">{formatAmount(item.amount || 0)}</span>
              <GlassButton variant="ghost" onClick={() => onDelete(item.id)}>
                Удалить
              </GlassButton>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="muted">Пока нет записей.</div>}
      </div>
    </GlassCard>
  );
}
