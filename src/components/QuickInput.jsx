import { useEffect, useMemo, useState } from "react";
import { parseInput } from "../lib/parse";
import { nowInTashkent } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";

const EXAMPLES = [
  "такси 18000 вчера",
  "зп 4 млн",
  "кредит 350000 15.02.2026",
  "цель айфон 12 млн до 01.06.2026"
];

export default function QuickInput({ onAdd }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!raw.trim()) {
      setPreview(null);
      return;
    }
    setPreview(parseInput(raw, nowInTashkent()));
  }, [raw]);

  const hasAmountWarning = useMemo(
    () => preview?.warnings?.includes("amount_not_found"),
    [preview]
  );

  const handleSubmit = async () => {
    if (!preview || hasAmountWarning) return;
    await onAdd(preview, raw);
    setRaw("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <GlassCard>
      <div className="card-title">Запиши как в заметках</div>
      <p className="helper-text">
        Напиши расход, доход, цель или платеж обычным текстом.
      </p>
      <div className="hero-input">
        <GlassInput
          placeholder="Напиши: такси 18000 вчера или кредит 350000 15.02.2026"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <GlassButton onClick={handleSubmit}>Добавить</GlassButton>
      </div>
      <div className="helper-text" style={{ marginTop: 10 }}>
        Примеры: {EXAMPLES.join(" · ")}
      </div>
      {preview && (
        <div style={{ marginTop: 14 }}>
          <div className="row">
            <span className="badge">
              {hasAmountWarning ? "⚠️ Не вижу сумму" : "✅ Распознано"}
            </span>
            {!hasAmountWarning && (
              <span className="badge">
                {preview.type === "income" ? "Доход" : "Расход"}
              </span>
            )}
            {!hasAmountWarning && <span className="badge">{preview.category}</span>}
            {!hasAmountWarning && (
              <span className="badge">{preview.amount?.toLocaleString("ru-RU")}</span>
            )}
            {!hasAmountWarning && <span className="badge">{preview.occurredAtISO}</span>}
          </div>
          {hasAmountWarning && (
            <div className="alert alert-danger" style={{ marginTop: 10 }}>
              Не вижу сумму. Напиши ее словами или цифрами.
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
