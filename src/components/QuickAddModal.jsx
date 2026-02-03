import { useEffect, useMemo, useState } from "react";
import { parseInput } from "../lib/parse";
import { formatISOWithOffset, getTzParts, makeTashkentDate, nowInTashkent } from "../lib/timezone";
import { useUser } from "../lib/user";
import {
  addDebt,
  addPayment,
  addTransaction,
  adjustWalletBalance,
  updateDebt,
  watchDebts,
  watchSettings
} from "../lib/store";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";
import { useI18n } from "./I18nProvider";
import { getMonthRangeFor } from "../lib/utils";

export default function QuickAddModal() {
  const user = useUser();
  const { t, lang } = useI18n();
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
  const [debtMode, setDebtMode] = useState("none");
  const [debts, setDebts] = useState([]);
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [settings, setSettings] = useState(null);
  const categoryLabel = (key) => {
    if (key === "income") return t("typeIncome");
    if (key === "food") return t("categoryFood");
    if (key === "transport") return t("categoryTransport");
    if (key === "credit") return t("categoryCredit");
    if (key === "rent") return t("categoryRent");
    if (key === "health") return t("categoryHealth");
    if (key === "carryover") return t("categoryCarryover");
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
      setDebtMode("none");
      setSelectedDebtId("");
      return;
    }
    setPreview(parseInput(raw, nowInTashkent()));
  }, [raw]);

  useEffect(() => {
    if (!open || !user) return;
    return watchDebts(user.uid, setDebts);
  }, [open, user]);

  useEffect(() => {
    if (!open || !user) return;
    return watchSettings(user.uid, setSettings);
  }, [open, user]);

  const applyWalletDelta = async (delta) => {
    if (!user || !delta) return;
    await adjustWalletBalance(user.uid, delta);
  };

  const walletDebug = useMemo(() => {
    return settings ? Number(settings.walletBalance || 0) : null;
  }, [settings]);

  useEffect(() => {
    if (!preview) return;
    if (!typeTouched) {
      setTypeOverride("auto");
    }
    if (preview.categoryDetected && !categoryTouched) {
      setCategoryOverride(preview.category);
    }
  }, [preview, typeTouched, categoryTouched]);

  const isDebtType = debtMode !== "none";
  const effectiveTypeForUi = useMemo(() => {
    if (debtMode === "borrow" || debtMode === "collect") return "income";
    if (debtMode === "repay" || debtMode === "lend") return "expense";
    return typeOverride === "auto" ? preview?.type || "expense" : typeOverride;
  }, [debtMode, typeOverride, preview]);
  const hasAmountWarning = useMemo(
    () => preview?.warnings?.includes("amount_not_found"),
    [preview]
  );
  const showCategorySelect =
    preview &&
    debtMode === "none" &&
    !preview.categoryDetected &&
    effectiveTypeForUi !== "income";
  const showDebtSelect = debtMode === "repay" || debtMode === "collect";

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

  const formatDateTimeLabel = (date, showTime) => {
    if (!date) return "";
    const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
    const options = showTime
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "2-digit", day: "2-digit" };
    return date.toLocaleString(locale, options);
  };

  const handleSubmit = async () => {
    if (!preview || !user) return;
    if (hasAmountWarning) {
      setSavedNotice(t("noAmountText"));
      return;
    }
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
    const dateISO =
      customDate?.dateISO ||
      preview.dateISO ||
      preview.occurredAtISO?.slice(0, 10);
    const payDateISO = dateISO || new Date().toISOString().slice(0, 10);

    setSavedNotice("");
    if (debtMode !== "none") {
      const amount = Number(preview.amount || 0);
      if (!amount || amount <= 0) {
        setSavedNotice(t("noAmountText"));
        return;
      }
      if ((debtMode === "repay" || debtMode === "collect") && !selectedDebtId) {
        setSavedNotice(t("debtChoose"));
        return;
      }
    }
    const closeModalAfterSave = () => {
      setOpen(false);
      setRaw("");
      setPreview(null);
      setDebtMode("none");
      setSelectedDebtId("");
      setIsRecurring(false);
    };
    closeModalAfterSave();
    let success = false;
    try {
      if (debtMode !== "none") {
        const amount = Number(preview.amount || 0);
        if (debtMode === "borrow" || debtMode === "lend") {
          await addDebt(user.uid, {
            title: preview.description || raw || t("debtTitle"),
            amount,
            remaining: amount,
            direction: debtMode === "borrow" ? "borrowed" : "lent",
            createdDateISO: dateISO
          });
          await addTransaction(user.uid, {
            amount,
            occurredAt: occurredAtDate,
            occurredAtISO,
            category: "credit",
            type: debtMode === "borrow" ? "income" : "expense",
            incomePeriod: debtMode === "borrow" ? preview.incomePeriod || null : null,
            description: preview.description || t("debtTitle"),
            raw
          });
          await applyWalletDelta(debtMode === "borrow" ? amount : -amount);
          setSavedNotice(t("recordAdded"));
          setTimeout(() => setSavedNotice(""), 1500);
          success = true;
        } else {
          const debt = debts.find((d) => d.id === selectedDebtId);
          const remaining = Math.max(0, Number(debt.remaining || 0) - amount);
          await updateDebt(user.uid, debt.id, {
            remaining,
            updatedAt: new Date(),
            isClosed: remaining <= 0
          });
          await addTransaction(user.uid, {
            amount,
            occurredAt: occurredAtDate,
            occurredAtISO,
            category: "credit",
            type: debtMode === "repay" ? "expense" : "income",
            incomePeriod: debtMode === "collect" ? preview.incomePeriod || null : null,
            description: debt.title || t("debtTitle"),
            raw
          });
          await applyWalletDelta(debtMode === "collect" ? amount : -amount);
          setSavedNotice(t("recordAdded"));
          setTimeout(() => setSavedNotice(""), 1500);
          success = true;
        }
      } else {
        await addTransaction(user.uid, {
          amount: preview.amount,
          occurredAt: occurredAtDate,
          occurredAtISO,
          category: effectiveCategory,
          type: effectiveType,
          incomePeriod: effectiveType === "income" ? preview.incomePeriod || null : null,
          description: preview.description,
          isRecurring: Boolean(isRecurring),
          raw
        });
        if (isRecurring) {
          await addPayment(user.uid, {
            amount: preview.amount,
            payDateISO,
            payDateTimeISO: occurredAtISO,
            title: preview.description || raw || t("monthlyExpense"),
            recurrence: "monthly"
          });
          setSavedNotice(t("monthlyPaymentAdded"));
        }
        if (!isRecurring) {
          setSavedNotice(t("recordAdded"));
        }
        setTimeout(() => setSavedNotice(""), 2500);
        success = true;
      }
    } catch (err) {
      setSavedNotice(`${t("saveFailed")}${err?.message ? `: ${err.message}` : ""}`);
      setTimeout(() => setSavedNotice(""), 2000);
    }
    if (!success) {
      setOpen(true);
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
                <div>
                  <strong>{t("addRecordOneLine")}</strong>
                  <div className="modal-hint">{t("quickPlaceholder")}</div>
                </div>
                <GlassButton variant="ghost" onClick={() => setOpen(false)}>
                  {t("close")}
                </GlassButton>
              </div>
              <div className="modal-body">
                <div className="modal-card">
                  <div className="modal-label">{t("quickAdd")}</div>
                  <GlassInput
                    placeholder={t("quickPlaceholder")}
                    value={raw}
                    onChange={(event) => setRaw(event.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="modal-card">
                  <div className="modal-card-header">
                    <div>
                      <div className="modal-label">{t("typeLabel")}</div>
                      <div className="modal-hint">{t("typeHint")}</div>
                    </div>
                  </div>
                  <div className="pill-tabs compact">
                    <button
                      type="button"
                      className={`pill-tab compact ${!isDebtType && typeOverride === "auto" ? "pill-tab-active" : ""}`}
                      onClick={() => {
                        setDebtMode("none");
                        setTypeOverride("auto");
                        setTypeTouched(true);
                      }}
                    >
                      {t("typeAuto")}
                    </button>
                    <button
                      type="button"
                      className={`pill-tab compact ${!isDebtType && typeOverride === "income" ? "pill-tab-active" : ""}`}
                      onClick={() => {
                        setDebtMode("none");
                        setTypeOverride("income");
                        setTypeTouched(true);
                      }}
                    >
                      {t("typeIncome")}
                    </button>
                    <button
                      type="button"
                      className={`pill-tab compact ${!isDebtType && typeOverride === "expense" ? "pill-tab-active" : ""}`}
                      onClick={() => {
                        setDebtMode("none");
                        setTypeOverride("expense");
                        setTypeTouched(true);
                      }}
                    >
                      {t("typeExpense")}
                    </button>
                    <button
                      type="button"
                      className={`pill-tab compact ${isDebtType ? "pill-tab-active" : ""}`}
                      onClick={() => {
                        setDebtMode((current) => (current === "none" ? "borrow" : current));
                        setTypeTouched(true);
                      }}
                    >
                      {t("typeDebt")}
                    </button>
                  </div>
                </div>
                {isDebtType && (
                  <div className="modal-card">
                    <div className="modal-card-header">
                      <div>
                        <div className="modal-label">{t("debtLabel")}</div>
                        <div className="modal-hint">{t("debtHint")}</div>
                      </div>
                    </div>
                    <div className="debt-grid">
                      <button
                        type="button"
                        className={`debt-button ${debtMode === "none" ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDebtMode("none");
                        }}
                      >
                        {t("debtNone")}
                      </button>
                      <button
                        type="button"
                        className={`debt-button ${debtMode === "borrow" ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDebtMode("borrow");
                        }}
                      >
                        {t("debtBorrow")}
                      </button>
                      <button
                        type="button"
                        className={`debt-button ${debtMode === "repay" ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDebtMode("repay");
                        }}
                      >
                        {t("debtRepay")}
                      </button>
                      <button
                        type="button"
                        className={`debt-button ${debtMode === "lend" ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDebtMode("lend");
                        }}
                      >
                        {t("debtLend")}
                      </button>
                      <button
                        type="button"
                        className={`debt-button ${debtMode === "collect" ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDebtMode("collect");
                        }}
                      >
                        {t("debtCollect")}
                      </button>
                    </div>
                    {showDebtSelect && (
                      <div className="modal-row" style={{ marginTop: 10 }}>
                        <select
                          value={selectedDebtId}
                          onChange={(event) => setSelectedDebtId(event.target.value)}
                          className="modal-select"
                        >
                          <option value="">{t("debtChoose")}</option>
                          {debts
                            .filter((d) =>
                              debtMode === "repay" ? d.direction === "borrowed" : d.direction === "lent"
                            )
                            .filter((d) => !d.isClosed && Number(d.remaining || 0) > 0)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.title || t("debtTitle")} • {formatAmount(Number(d.remaining || 0))}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    {debts.length > 0 && (
                      <div className="list">
                        {debts
                          .filter((d) => !d.isClosed && Number(d.remaining || 0) > 0)
                          .slice(0, 4)
                          .map((d) => (
                            <div key={d.id} className="list-item">
                              <div className="list-item-meta">
                                <strong>{d.title || t("debtTitle")}</strong>
                                <span className="muted">
                                  {formatAmount(Number(d.remaining || 0))}
                                </span>
                              </div>
                              <span className="badge">
                                {d.direction === "borrowed" ? t("debtBorrow") : t("debtLend")}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                {showCategorySelect && (
                  <div className="modal-card">
                    <div className="modal-label">{t("categorySelect")}</div>
                    <select
                      value={categoryOverride}
                      onChange={(event) => {
                        setCategoryOverride(event.target.value);
                        setCategoryTouched(true);
                      }}
                      className="modal-select"
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
                <div className="modal-card">
                  <div className="modal-label">{t("optionsLabel")}</div>
                  <div className="modal-grid">
                    {effectiveTypeForUi === "expense" && (
                      <label className="modal-check">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(event) => setIsRecurring(event.target.checked)}
                        />
                        <span>{t("monthlyExpense")}</span>
                      </label>
                    )}
                    <label className="modal-check">
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
                  </div>
                  {useCustomDate && (
                    <div className="modal-row" style={{ marginTop: 10 }}>
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
                </div>
                {preview && (
                  <div className="modal-card">
                    <div className="modal-label">{t("summaryLabel")}</div>
                    <div className="summary-grid">
                      <div className="summary-row">
                        <span className="summary-label">{t("summaryStatus")}</span>
                        <span className="summary-value">
                          {hasAmountWarning ? t("noAmount") : t("recognized")}
                        </span>
                      </div>
                      {!hasAmountWarning && (
                        <div className="summary-row">
                          <span className="summary-label">{t("summaryType")}</span>
                          <span className="summary-value">
                            {effectiveTypeForUi === "income" ? t("typeIncome") : t("typeExpense")}
                          </span>
                        </div>
                      )}
                      {!hasAmountWarning && (
                        <div className="summary-row">
                          <span className="summary-label">{t("summaryCategory")}</span>
                          <span className="summary-value">
                            {categoryLabel(
                              effectiveTypeForUi === "income"
                                ? "income"
                                : preview.categoryDetected
                                  ? preview.category
                                  : categoryOverride || "other"
                            )}
                          </span>
                        </div>
                      )}
                      {!hasAmountWarning && (
                        <div className="summary-row">
                          <span className="summary-label">{t("summaryAmount")}</span>
                          <span className="summary-value">
                            {formatAmount(preview.amount)}
                          </span>
                        </div>
                      )}
                      {!hasAmountWarning && (
                        <div className="summary-row">
                          <span className="summary-label">{t("summaryDate")}</span>
                          <span className="summary-value">
                            {formatDateTimeLabel(
                              useCustomDate ? buildCustomDate(customDateISO)?.occurredAtDate : preview.occurredAtDate,
                              useCustomDate ? true : preview.hasTime
                            )}
                          </span>
                        </div>
                      )}
                      {!hasAmountWarning && isRecurring && (
                        <div className="summary-row">
                          <span className="summary-label">{t("summaryRecurring")}</span>
                          <span className="summary-value">{t("summaryRecurringYes")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {showCategorySelect && !categoryOverride && (
                  <div className="alert alert-danger">{t("categoryMissing")}</div>
                )}
                {hasAmountWarning && (
                  <div className="alert alert-danger">
                    {t("noAmountText")}
                  </div>
                )}
                <div className="modal-footer">
                  {savedNotice && <div className="toast">{savedNotice}</div>}
                  {walletDebug !== null && (
                    <div className="helper-text">
                      {t("wallet")}: {formatAmount(walletDebug)}
                    </div>
                  )}
                  <GlassButton
                    onClick={handleSubmit}
                    disabled={
                      !preview ||
                      (debtMode === "none" && hasAmountWarning) ||
                      (showCategorySelect && !categoryOverride) ||
                      (showDebtSelect && !selectedDebtId)
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
          </div>
        </ModalPortal>
      )}
    </>
  );
}
