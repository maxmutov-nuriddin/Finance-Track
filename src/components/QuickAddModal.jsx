import { useEffect, useMemo, useState } from "react";
import { parseInput } from "../lib/parse";
import { nowInTashkent } from "../lib/timezone";
import { useUser } from "../lib/user";
import { addTransaction } from "../lib/store";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";

export default function QuickAddModal() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [savedNotice, setSavedNotice] = useState("");

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
    if (!preview || hasAmountWarning || !user) return;
    await addTransaction(user.uid, {
      amount: preview.amount,
      occurredAt: preview.occurredAtDate,
      occurredAtISO: preview.occurredAtISO,
      category: preview.category,
      type: preview.type,
      incomePeriod: preview.incomePeriod || null,
      description: preview.description,
      raw
    });
    setSavedNotice("Запись добавлена");
    setTimeout(() => setSavedNotice(""), 1500);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <>
      <GlassButton onClick={() => setOpen(true)}>Записать</GlassButton>
      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>Запись одной строкой</strong>
              <GlassButton variant="ghost" onClick={() => setOpen(false)}>
                Закрыть
              </GlassButton>
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassInput
                placeholder="Напиши: зп 4 млн или такси 18000 вчера"
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              {preview && (
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
                    <span className="badge">{formatAmount(preview.amount)}</span>
                  )}
                  {!hasAmountWarning && <span className="badge">{preview.occurredAtISO}</span>}
                </div>
              )}
              {preview?.amount && !hasAmountWarning && (
                <div className="helper-text">Сумма: {formatAmount(preview.amount)}</div>
              )}
              {hasAmountWarning && (
                <div className="alert alert-danger">
                  Не вижу сумму — напиши цифрами или словами.
                </div>
              )}
              {savedNotice && <div className="alert">{savedNotice}</div>}
              <GlassButton onClick={handleSubmit} disabled={!preview || hasAmountWarning}>
                Добавить
              </GlassButton>
              <div className="helper-text">
                Примеры: зп 4 млн · такси 18000 вчера · кредит 350000 15.02.2026
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
