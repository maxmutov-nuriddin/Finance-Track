import { useEffect, useMemo, useState } from "react";
import { parseInput } from "../lib/parse";
import { nowInTashkent } from "../lib/timezone";
import { useUser } from "../lib/user";
import { addTransaction } from "../lib/store";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";
import { useI18n } from "./I18nProvider";

export default function QuickAddModal() {
  const user = useUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [savedNotice, setSavedNotice] = useState("");
  const categoryLabel = (key) => {
    if (key === "food") return t("categoryFood");
    if (key === "transport") return t("categoryTransport");
    if (key === "credit") return t("categoryCredit");
    if (key === "rent") return t("categoryRent");
    if (key === "health") return t("categoryHealth");
    return t("categoryOther");
  };

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
    setSavedNotice("");
    setOpen(false);
    setRaw("");
    setPreview(null);
    try {
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
      setSavedNotice(t("recordAdded"));
      setTimeout(() => setSavedNotice(""), 1500);
    } catch (err) {
      setSavedNotice(t("saveFailed"));
      setTimeout(() => setSavedNotice(""), 2000);
    }
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
      <GlassButton onClick={() => setOpen(true)}>{t("quickAdd")}</GlassButton>
      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>{t("addRecordOneLine")}</strong>
              <GlassButton variant="ghost" onClick={() => setOpen(false)}>
                {t("close")}
              </GlassButton>
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassInput
                placeholder={t("quickPlaceholder")}
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              {preview && (
                <div className="row">
                  <span className="badge">
                    {hasAmountWarning ? t("noAmount") : t("recognized")}
                  </span>
                  {!hasAmountWarning && (
                    <span className="badge">
                      {preview.type === "income" ? t("typeIncome") : t("typeExpense")}
                    </span>
                  )}
                  {!hasAmountWarning && (
                    <span className="badge">{categoryLabel(preview.category)}</span>
                  )}
                  {!hasAmountWarning && (
                    <span className="badge">{formatAmount(preview.amount)}</span>
                  )}
                  {!hasAmountWarning && <span className="badge">{preview.occurredAtISO}</span>}
                </div>
              )}
              {preview?.amount && !hasAmountWarning && (
                <div className="helper-text">{t("amount")}: {formatAmount(preview.amount)}</div>
              )}
              {hasAmountWarning && (
                <div className="alert alert-danger">
                  {t("noAmountText")}
                </div>
              )}
              {savedNotice && <div className="toast">{savedNotice}</div>}
              <GlassButton onClick={handleSubmit} disabled={!preview || hasAmountWarning}>
                {t("add")}
              </GlassButton>
              <div className="helper-text">
                {t("examples")}
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
