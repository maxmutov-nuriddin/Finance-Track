import { useMemo, useState } from "react";
import { enableNotifications, getNotificationStatus } from "../lib/notifications";
import { parsePaymentInput } from "../lib/parse";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";

export default function PaymentsPanel({ uid, payments, onAdd, onDelete }) {
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
      setNotice("Не удалось распознать сумму или дату. Пример: кредит 350000 15.02.2026");
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
          <div className="card-title">Платежи</div>
          <div className="muted">Добавляй обязательные платежи одной строкой.</div>
        </div>
        <GlassButton onClick={() => setOpen(true)}>Добавить платеж</GlassButton>
      </div>

      {notificationStatus !== "granted" ? (
        <div className="alert" style={{ marginTop: 12 }}>
          Уведомления выключены. Включи, чтобы получать напоминания.
          <div style={{ marginTop: 8 }}>
            <GlassButton variant="secondary" onClick={handleEnableNotifications}>
              Включить уведомления
            </GlassButton>
          </div>
        </div>
      ) : (
        <div className="alert" style={{ marginTop: 12 }}>
          Уведомления включены — напомним за 3 дня.
        </div>
      )}

      <div className="list" style={{ marginTop: 14 }}>
        {payments.map((payment) => (
          <div className="list-item" key={payment.id}>
            <div className="list-item-meta">
              <strong>{payment.title}</strong>
              <span className="muted">{payment.payDateISO}</span>
              {payment.recurrence === "monthly" ? (
                <span className="badge">Ежемесячно (в бюджете)</span>
              ) : (
                <span className="badge">Разовый (не в бюджете)</span>
              )}
            </div>
            <div className="row">
              <span className="badge">{formatAmount(payment.amount)}</span>
              <GlassButton variant="ghost" onClick={() => onDelete(payment.id)}>
                Удалить
              </GlassButton>
            </div>
          </div>
        ))}
        {!payments.length && <div className="muted">Платежей пока нет.</div>}
      </div>

      {upcoming.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="card-title">Через 3 дня</div>
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
              <strong>Новый платеж</strong>
              <GlassButton variant="ghost" onClick={() => setOpen(false)}>
                Закрыть
              </GlassButton>
            </div>
            {notice && (
              <div className="alert alert-danger" style={{ marginTop: 10 }}>
                {notice}
              </div>
            )}
            <div className="stack" style={{ marginTop: 12 }}>
              <GlassInput
                placeholder="Например: кредит 350000 15.02.2026 (ежемесячно)"
                value={quickRaw}
                onChange={(event) => setQuickRaw(event.target.value)}
              />
              <div className="helper-text">
                Добавь "ежемесячно" если платеж повторяется каждый месяц.
              </div>
              <GlassButton onClick={handleQuickAdd}>Добавить</GlassButton>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </GlassCard>
  );
}
