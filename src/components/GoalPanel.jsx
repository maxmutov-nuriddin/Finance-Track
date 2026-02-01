import { useMemo, useState } from "react";
import { addDaysInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";

function formatRuDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function computeAutoDateISO(daysToGoal) {
  const base = makeTashkentDate(getTzParts(new Date()));
  const parts = addDaysInTz(base, daysToGoal);
  return formatDateISO(parts);
}

export default function GoalPanel({
  goals,
  monthlyNet,
  dailyNet,
  onAdd,
  onDelete,
  activeGoalId,
  targetSavingsMode,
  fixedMonthlySavings,
  plannedMonthlySavings
}) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [manualDateEnabled, setManualDateEnabled] = useState(false);

  const canAdd = title.trim();

  const handleAdd = () => {
    if (!canAdd) return;
    const parsedTarget = Number(targetAmount);
    const computedTarget =
      !parsedTarget || Number.isNaN(parsedTarget)
        ? Math.max(0, Math.round(monthlyNet))
        : parsedTarget;
    if (!computedTarget) {
      setNotice("Нет суммы и нулевая/отрицательная средняя прибыль за месяц.");
      return;
    }
    onAdd({
      title: title.trim(),
      targetAmount: computedTarget,
      manualTargetDateISO: manualDateEnabled ? targetDate || null : null,
      isAutoDate: !manualDateEnabled,
      targetDateISO: manualDateEnabled ? targetDate || null : null
    });
    setTitle("");
    setTargetAmount("");
    setTargetDate("");
    setNotice("");
    setOpen(false);
    setManualDateEnabled(false);
  };

  const renderedGoals = useMemo(
    () =>
      goals.map((goal) => {
        const saved = Number(goal.currentAmount || 0);
        const remaining = Math.max(0, goal.targetAmount - saved);
        let forecast = "";
        let perMonth = "";
        let perDay = "";
        let autoLabel = "";
        let autoHint = "";
        const progress = goal.targetAmount
          ? Math.min(100, Math.round((saved / goal.targetAmount) * 100))
          : 0;

        const manualDateISO = goal.manualTargetDateISO || goal.targetDateISO;

        if (manualDateISO) {
          const target = new Date(`${manualDateISO}T00:00:00`);
          const today = new Date();
          const diffDays = Math.max(
            1,
            Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
          );
          const needed = Math.ceil(remaining / diffDays);
          perDay = `Чтобы успеть к этой дате, нужно откладывать ${formatAmount(needed)} в день.`;
        } else if (dailyNet <= 0) {
          autoLabel = "С текущими расходами цель не приближается.";
          autoHint = "Дата рассчитана автоматически и обновляется при новых записях.";
        } else {
          const daysToGoal = Math.ceil(remaining / dailyNet);
          const autoDateISO = computeAutoDateISO(daysToGoal);
          const monthsToGoal = Math.ceil(daysToGoal / 30);
          forecast = `Купишь примерно через ${monthsToGoal} мес.`;
          autoLabel = `Если продолжишь так же, купишь примерно к ${formatRuDate(autoDateISO)}.`;
          autoHint = "Дата рассчитана автоматически и обновляется при изменении расходов.";
          const perMonthNeeded = Math.ceil(remaining / Math.max(1, monthsToGoal));
          perMonth = `Нужно откладывать: ${formatAmount(perMonthNeeded)} / мес.`;
        }

        if (targetSavingsMode === "fixed" && fixedMonthlySavings) {
          if (activeGoalId && goal.id === activeGoalId) {
            perMonth = `По плану откладываешь: ${formatAmount(fixedMonthlySavings)} / мес. (активная цель)`;
          } else if (activeGoalId) {
            perMonth = "В очереди (фикс накоплений идет на активную цель)";
          } else {
            perMonth = `Фикс накоплений: ${formatAmount(fixedMonthlySavings)} / мес.`;
          }
        } else {
          const monthsRaw = manualDateISO
            ? Math.ceil((new Date(manualDateISO) - new Date()) / (1000 * 60 * 60 * 24 * 30))
            : 6;
          const months = Math.max(1, monthsRaw);
          const needed = Math.ceil(remaining / months);

          if (!activeGoalId) {
            perMonth = `Если сделать активной: нужно ${formatAmount(needed)} / мес.`;
          } else if (goal.id !== activeGoalId) {
            perMonth = `Если сделать активной: нужно ${formatAmount(needed)} / мес.`;
          } else {
            perMonth = `По плану откладываешь: ${formatAmount(plannedMonthlySavings)} / мес. (активная цель)`;
          }
        }

        return {
          ...goal,
          saved,
          remaining,
          forecast,
          perMonth,
          perDay,
          autoLabel,
          autoHint,
          manualDateISO,
          progress
        };
      }),
    [goals, monthlyNet, dailyNet]
  );

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">Цели</div>
          <div className="muted">Добавляй цель одной кнопкой.</div>
        </div>
        <GlassButton onClick={() => setOpen(true)}>Добавить цель</GlassButton>
      </div>

      {targetSavingsMode === "goal_based" && !activeGoalId && (
        <div className="alert" style={{ marginTop: 12 }}>
          Выбери главную цель для расчета плана.
        </div>
      )}

      <div className="list" style={{ marginTop: 12 }}>
        {renderedGoals.map((goal) => (
          <div className="list-item" key={goal.id}>
            <div className="list-item-meta">
              <strong>{goal.title}</strong>
              <div className="progress" style={{ marginTop: 6, marginBottom: 6 }}>
                <span style={{ width: `${goal.progress}%` }} />
              </div>
              <span className="muted">Прогресс: {goal.progress}%</span>
              <span className="muted">
                Накоплено: {formatAmount(goal.saved)}
              </span>
              <span className="muted">Осталось: {formatAmount(goal.remaining)}</span>
              {goal.perMonth && <span className="muted">{goal.perMonth}</span>}
              {goal.perDay && <span className="muted">{goal.perDay}</span>}
              {goal.forecast && <span className="muted">{goal.forecast}</span>}
              {goal.autoLabel && <span className="muted">{goal.autoLabel}</span>}
              {goal.autoHint && <span className="helper-text">{goal.autoHint}</span>}
            </div>
            <GlassButton variant="ghost" onClick={() => onDelete(goal.id)}>
              Удалить
            </GlassButton>
          </div>
        ))}
        {!goals.length && <div className="muted">Пока нет целей.</div>}
      </div>

      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>Новая цель</strong>
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
                placeholder="Например: Айфон"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <GlassInput
                placeholder="Сумма (можно оставить пустой)"
                type="number"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
              />
              {targetAmount && (
                <div className="helper-text">{formatAmount(targetAmount)}</div>
              )}
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={manualDateEnabled}
                  onChange={(event) => setManualDateEnabled(event.target.checked)}
                />
                <span className="muted">Я хочу указать дату сам</span>
              </label>
              {manualDateEnabled && (
                <GlassInput
                  placeholder="Дата (дд.мм.гггг)"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              )}
              <GlassButton onClick={handleAdd} disabled={!canAdd}>
                Добавить
              </GlassButton>
              <div className="helper-text">
                Если сумма пустая — подставим твою среднюю прибыль за месяц.
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </GlassCard>
  );
}
