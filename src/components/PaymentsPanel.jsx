import { useMemo, useState } from "react";
import { enableNotifications, getNotificationStatus } from "../lib/notifications";
import { parsePaymentInput } from "../lib/parse";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";
import { useI18n } from "./I18nProvider";

export default function PaymentsPanel({ uid, payments, onAdd, onDelete }) {
  const { t } = useI18n();
  const [quickRaw, setQuickRaw] = useState("");
  const [notificationStatus, setNotificationStatus] = useState(getNotificationStatus());
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);

  const upcomingAlertDateISO = useMemo(() => {
    const base = makeTashkentDate(getTzParts(new Date()));
    const parts = addDaysInTz(base, 3);
    return formatDateISO(parts);
  }, []);

  const upcoming = useMemo(
    () => payments.filter((pay) => pay.payDateISO === upcomingAlertDateISO),
    [payments, upcomingAlertDateISO]
  );

  const handleQuickAdd = () => {
    if (!quickRaw.trim()) return;
    const parsed = parsePaymentInput(quickRaw, new Date());
    if (parsed.warnings.length) {
      setNotice(t("noAmountText"));
      return;
    }
    onAdd({
      title: parsed.title,
      amount: parsed.amount,
      payDateISO: parsed.payDateISO,
      recurrence: parsed.recurrence
    });
    setQuickRaw("");
    setNotice("");
    setOpen(false);
  };

  const handleEnableNotifications = async () => {
    const result = await enableNotifications(uid);
    setNotificationStatus(result.status === "enabled" ? "granted" : result.status);
  };

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("paymentsTitle")}</div>
          <div className="muted">{t("paymentsHelp")}</div>
        </div>
        <GlassButton onClick={() => setOpen(true)}>{t("addPayment")}</GlassButton>
      </div>

      {notificationStatus !== "granted" ? (
        <div className="alert" style={{ marginTop: 12 }}>
          {t("notificationsOff")}
          <div style={{ marginTop: 8 }}>
            <GlassButton variant="secondary" onClick={handleEnableNotifications}>
              {t("enableNotifications")}
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="alert" style={{ marginTop: 12 }}>
          {t("notificationsOn")}
        </div>
      )}

      <div className="list" style={{ marginTop: 14 }}>
        {payments.map((payment) => (
          <div className="list-item" key={payment.id}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
              {payment.recurrence === "monthly" ? (
                <span className="badge">{t("monthlyInBudget")}</span>
              ) : (
                <span className="badge">{t("oneTimeNotBudget")}</span>
              )}
            </div>
            <div className="row">
              <span className="badge">{formatAmount(payment.amount)}</span>
              <GlassButton variant="ghost" onClick={() => onDelete(payment.id)}>
                {t("delete")}
              </GlassButton>
            </div>
          </div>
        ))}
        {!payments.length && <div className="muted">{t("noPaymentsYet")}</div>}
      </div>

      {upcoming.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="card-title">{t("in3days")}</div>
          <div className="list">
            {upcoming.map((payment) => (
              <div className="list-item" key={`up-${payment.id}`}>
                <div className="list-item-meta">
                  <strong>{payment.title}</strong>
                  <span className="muted">{formatAmount(payment.amount)}</span>
                </div>
                <span className="badge">{payment.payDateISO}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>{t("newPayment")}</strong>
              <GlassButton variant="ghost" onClick={() => setOpen(false)}>
                {t("close")}
              </GlassButton>
            </div>
            {notice && (
              <div className="alert alert-danger" style={{ marginTop: 10 }}>
                {notice}
              </div>
            )}
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassInput
                placeholder={t("paymentPlaceholder")}
                value={quickRaw}
                onChange={(event) => setQuickRaw(event.target.value)}
              />
              <div className="helper-text">{t("paymentHint")}</div>
              <GlassButton onClick={handleQuickAdd}>{t("add")}</GlassButton>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </GlassCard>
  );
}