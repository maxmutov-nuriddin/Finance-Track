import { useMemo, useState } from "react";
import { addMonthsInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import GlassInput from "./GlassInput";
import { formatAmount } from "../lib/format";
import ModalPortal from "./ModalPortal";
import { useI18n } from "./I18nProvider";

function formatRuDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function computeAutoDateISO(monthsToGoal) {
  const base = makeTashkentDate(getTzParts(new Date()));
  const parts = addMonthsInTz(base, monthsToGoal);
  return formatDateISO(parts);
}

export default function GoalPanel({
  goals,
  monthlyNet,
  dailyNet,
  onAdd,
  onDelete,
  onContribute,
  onComplete,
  deletingIds,
  activeGoalId,
  targetSavingsMode,
  fixedMonthlySavings,
  plannedMonthlySavings
}) {
  const { t } = useI18n();
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
      setNotice(t("budgetWarnNegative"));
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
        const contributionAmount = Math.max(0, Math.round(plannedMonthlySavings || 0));
        const isActive = activeGoalId ? goal.id === activeGoalId : false;
        const saved = Number(goal.currentAmount || 0);
        const remaining = Math.max(0, goal.targetAmount - saved);
        const isCompleted = Boolean(goal.isCompleted || goal.completedAt) || remaining <= 0;
        const canContribute = isActive && contributionAmount > 0 && !isCompleted;
        const canComplete = remaining <= 0 && !goal.isCompleted;
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
          perDay = t("goalNeedPerDay", { amount: formatAmount(needed) });
        } else if (dailyNet <= 0) {
          autoLabel = t("goalNoProgress");
          autoHint = t("goalAutoHintNew");
        } else {
          const isActiveGoal = activeGoalId && goal.id === activeGoalId;
          const monthlyContribution = isActiveGoal
            ? Math.max(1, Math.round(plannedMonthlySavings || 0))
            : Math.max(1, Math.ceil(remaining / 6));
          const monthsToGoal = Math.max(1, Math.ceil(remaining / monthlyContribution));
          const autoDateISO = computeAutoDateISO(monthsToGoal);
          autoLabel = t("goalBuyBy", { date: formatRuDate(autoDateISO) });
          autoHint = t("goalAutoHintChange");
          forecast = t("goalBuyIn", { months: monthsToGoal });
          const perMonthNeeded = isActiveGoal
            ? monthlyContribution
            : Math.ceil(remaining / Math.max(1, monthsToGoal));
          perMonth = t("goalNeedPerMonth", { amount: formatAmount(perMonthNeeded) });
        }

        if (targetSavingsMode === "fixed" && fixedMonthlySavings) {
          if (activeGoalId && goal.id === activeGoalId) {
            perMonth = t("goalFixedActive", { amount: formatAmount(fixedMonthlySavings) });
          } else if (activeGoalId) {
            perMonth = t("goalFixedQueue");
          } else {
            perMonth = t("goalFixed", { amount: formatAmount(fixedMonthlySavings) });
          }
        } else {
          const monthsRaw = manualDateISO
            ? Math.ceil((new Date(manualDateISO) - new Date()) / (1000 * 60 * 60 * 24 * 30))
            : 6;
          const months = Math.max(1, monthsRaw);
          const needed = Math.ceil(remaining / months);

          if (!activeGoalId) {
            perMonth = t("goalIfActive", { amount: formatAmount(needed) });
          } else if (goal.id !== activeGoalId) {
            perMonth = t("goalIfActive", { amount: formatAmount(needed) });
          } else {
            perMonth = t("goalFixedActive", { amount: formatAmount(plannedMonthlySavings) });
          }
        }

        return {
          ...goal,
          contributionAmount,
          canContribute,
          isActive,
          isCompleted,
          canComplete,
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
    [goals, monthlyNet, dailyNet, t, activeGoalId, targetSavingsMode, fixedMonthlySavings, plannedMonthlySavings]
  );

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("goalsTitle")}</div>
          <div className="muted">{t("goalsHelp")}</div>
        </div>
        <GlassButton onClick={() => setOpen(true)}>{t("addGoal")}</GlassButton>
      </div>

      {targetSavingsMode === "goal_based" && !activeGoalId && (
        <div className="alert" style={{ marginTop: 12 }}>
          {t("chooseMainGoal")}
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
              <span className="muted">{t("progress")}: {goal.progress}%</span>
              <span className="muted">
                {t("savedAmount")}: {formatAmount(goal.saved)}
              </span>
              <span className="muted">{t("remaining")}: {formatAmount(goal.remaining)}</span>
              {goal.isCompleted && <span className="badge">{t("goalCompleted")}</span>}
              {goal.perMonth && <span className="muted">{goal.perMonth}</span>}
              {goal.perDay && <span className="muted">{goal.perDay}</span>}
              {goal.autoLabel && <span className="muted">{goal.autoLabel}</span>}
              {!goal.autoLabel && goal.forecast && <span className="muted">{goal.forecast}</span>}
              {goal.autoHint && <span className="helper-text">{goal.autoHint}</span>}
            </div>
            <div className="row" style={{ gap: 10 }}>
              {goal.canContribute && (
                <GlassButton onClick={() => onContribute?.(goal)}>
                  {t("goalContribute", { amount: formatAmount(goal.contributionAmount) })}
                </GlassButton>
              )}
              {goal.canComplete && (
                <GlassButton onClick={() => onComplete?.(goal)}>
                  {t("goalComplete")}
                </GlassButton>
              )}
              <GlassButton
                variant="ghost"
                onClick={() => onDelete(goal.id)}
                disabled={deletingIds?.has(goal.id)}
              >
                {t("delete")}
              </GlassButton>
            </div>
          </div>
        ))}
        {!goals.length && <div className="muted">{t("noGoals")}</div>}
      </div>

      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <strong>{t("newGoal")}</strong>
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
                placeholder={t("goalTitlePlaceholder")}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <GlassInput
                placeholder={t("goalAmountPlaceholder")}
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
                <span className="muted">{t("manualDate")}</span>
              </label>
              {manualDateEnabled && (
                <GlassInput
                  placeholder={t("goalDatePlaceholder")}
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              )}
              <GlassButton onClick={handleAdd} disabled={!canAdd}>
                {t("add")}
              </GlassButton>
              <div className="helper-text">{t("goalHelper")}</div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </GlassCard>
  );
}
