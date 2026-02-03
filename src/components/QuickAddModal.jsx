import { useEffect, useMemo, useState } from "react";
import { parseInput } from "../lib/parse";
import { formatISOWithOffset, getTzParts, makeTashkentDate, nowInTashkent } from "../lib/timezone";
import { useUser } from "../lib/user";
import { addPayment, addTransaction } from "../lib/store";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";
import { useI18n } from "./I18nProvider";
import { getMonthRangeFor } from "../lib/utils";

export default function QuickAddModal() {
  const user = useUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [savedNotice, setSavedNotice] = useState("");
  const [typeOverride, setTypeOverride] = useState("auto");
  const [typeTouched, setTypeTouched] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateISO, setCustomDateISO] = useState("");
  const categoryLabel = (key) => {
    if (key === "income") return t("typeIncome");
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
      setTypeOverride("auto");
      setTypeTouched(false);
      setCategoryOverride("");
      setCategoryTouched(false);
      setIsRecurring(false);
      setUseCustomDate(false);
      setCustomDateISO("");
      return;
    }
    setPreview(parseInput(raw, nowInTashkent()));
  }, [raw]);

  useEffect(() => {
    if (!preview) return;
    if (!typeTouched) {
      setTypeOverride("auto");
    }
    if (preview.categoryDetected && !categoryTouched) {
      setCategoryOverride(preview.category);
    }
  }, [preview, typeTouched, categoryTouched]);

  const hasAmountWarning = useMemo(
    () => preview?.warnings?.includes("amount_not_found"),
    [preview]
  );
  const effectiveTypeForUi = useMemo(
    () => (typeOverride === "auto" ? preview?.type || "expense" : typeOverride),
    [typeOverride, preview]
  );

  const monthRange = useMemo(() => getMonthRangeFor(nowInTashkent()), []);
  const maxDateISO = monthRange.endISO;
  const minDateISO = monthRange.startISO;

  const buildCustomDate = (dateISO) => {
    if (!dateISO) return null;
    const [year, month, day] = dateISO.split("-").map((value) => Number(value));
    const parts = { year, month, day, hour: 10, minute: 0, second: 0 };
    return {
      occurredAtDate: makeTashkentDate(parts),
      occurredAtISO: formatISOWithOffset(parts),
      dateISO
    };
  };

  const handleSubmit = async () => {
    if (!preview || hasAmountWarning || !user) return;
    const effectiveType =
      typeOverride === "auto" ? preview.type || "expense" : typeOverride;
    const effectiveCategory =
      effectiveType === "income"
        ? "income"
        : preview.categoryDetected
          ? preview.category
          : categoryOverride || "other";
    if (effectiveType !== "income" && !effectiveCategory) return;

    const customDate = useCustomDate ? buildCustomDate(customDateISO) : null;
    const occurredAtISO = customDate?.occurredAtISO || preview.occurredAtISO;
    const occurredAtDate = customDate?.occurredAtDate || preview.occurredAtDate;
    const dateISO = customDate?.dateISO || preview.occurredAtISO?.slice(0, 10);

    setSavedNotice("");
    setOpen(false);
    setRaw("");
    setPreview(null);
    try {
      await addTransaction(user.uid, {
        amount: preview.amount,
        occurredAt: occurredAtDate,
        occurredAtISO,
        category: effectiveCategory,
        type: effectiveType,
        incomePeriod: effectiveType === "income" ? preview.incomePeriod || null : null,
        description: preview.description,
        raw
      });
      if (isRecurring && effectiveType === "expense") {
        await addPayment(user.uid, {
          amount: preview.amount,
          payDateISO: dateISO,
          payDateTimeISO: occurredAtISO,
          title: preview.description || raw || t("monthlyExpense"),
          recurrence: "monthly"
        });
      }
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
              <div className="row">
                <span className="muted">{t("typeLabel")}</span>
                <div className="pill-tabs">
                  <button
                    type="button"
                    className={`pill-tab ${typeOverride === "expense" ? "pill-tab-active" : ""}`}
                    onClick={() => {
                      setTypeOverride("expense");
                      setTypeTouched(true);
                    }}
                  >
                    {t("typeExpense")}
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${typeOverride === "income" ? "pill-tab-active" : ""}`}
                    onClick={() => {
                      setTypeOverride("income");
                      setTypeTouched(true);
                    }}
                  >
                    {t("typeIncome")}
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${typeOverride === "auto" ? "pill-tab-active" : ""}`}
                    onClick={() => {
                      setTypeOverride("auto");
                      setTypeTouched(true);
                    }}
                  >
                    {t("typeAuto")}
                  </button>
                </div>
              </div>
              {preview && !preview.categoryDetected && effectiveTypeForUi !== "income" && (
                <div className="row">
                  <span className="muted">{t("categorySelect")}</span>
                  <select
                    value={categoryOverride}
                    onChange={(event) => {
                      setCategoryOverride(event.target.value);
                      setCategoryTouched(true);
                    }}
                  >
                    <option value="">{t("categoryChoose")}</option>
                    <option value="food">{t("categoryFood")}</option>
                    <option value="transport">{t("categoryTransport")}</option>
                    <option value="credit">{t("categoryCredit")}</option>
                    <option value="rent">{t("categoryRent")}</option>
                    <option value="health">{t("categoryHealth")}</option>
                    <option value="other">{t("categoryOther")}</option>
                  </select>
                </div>
              )}
              {effectiveTypeForUi === "expense" && (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                  />
                  <span>{t("monthlyExpense")}</span>
                </label>
              )}
              <label className="row">
                <input
                  type="checkbox"
                  checked={useCustomDate}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setUseCustomDate(next);
                    if (next && !customDateISO) {
                      setCustomDateISO(monthRange.endISO);
                    }
                  }}
                />
                <span>{t("customDate")}</span>
              </label>
              {useCustomDate && (
                <div className="row">
                  <span className="muted">{t("dateLabel")}</span>
                  <input
                    className="glass-input"
                    type="date"
                    value={customDateISO}
                    min={minDateISO}
                    max={maxDateISO}
                    onChange={(event) => setCustomDateISO(event.target.value)}
                  />
                </div>
              )}
              {preview && (
                <div className="row">
                  <span className="badge">
                    {hasAmountWarning ? t("noAmount") : t("recognized")}
                  </span>
                  {!hasAmountWarning && (
                    <span className="badge">
                      {effectiveTypeForUi === "income" ? t("typeIncome") : t("typeExpense")}
                    </span>
                  )}
                  {!hasAmountWarning && (
                    <span className="badge">
                      {categoryLabel(
                        effectiveTypeForUi === "income"
                          ? "income"
                          : preview.categoryDetected
                            ? preview.category
                            : categoryOverride || "other"
                      )}
                    </span>
                  )}
                  {!hasAmountWarning && (
                    <span className="badge">{formatAmount(preview.amount)}</span>
                  )}
                  {!hasAmountWarning && (
                    <span className="badge">
                      {useCustomDate && customDateISO
                        ? customDateISO
                        : preview.occurredAtISO}
                    </span>
                  )}
                </div>
              )}
              {preview?.amount && !hasAmountWarning && (
                <div className="helper-text">{t("amount")}: {formatAmount(preview.amount)}</div>
              )}
              {preview && !preview.categoryDetected && effectiveTypeForUi !== "income" && !categoryOverride && (
                <div className="alert alert-danger">{t("categoryMissing")}</div>
              )}
              {hasAmountWarning && (
                <div className="alert alert-danger">
                  {t("noAmountText")}
                </div>
              )}
              {savedNotice && <div className="toast">{savedNotice}</div>}
              <GlassButton
                onClick={handleSubmit}
                disabled={
                  !preview ||
                  hasAmountWarning ||
                  (preview && !preview.categoryDetected && effectiveTypeForUi !== "income" && !categoryOverride)
                }
              >
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
