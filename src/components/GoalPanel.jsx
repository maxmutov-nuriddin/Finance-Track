import { useMemo } from "react";
import { addMonthsInTz, formatDateISO, getTzParts, makeTashkentDate } from "../lib/timezone";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { formatAmount } from "../lib/format";
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
  dailyNet,
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
    [goals, dailyNet, t, activeGoalId, targetSavingsMode, fixedMonthlySavings, plannedMonthlySavings]
  );

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("goalsTitle")}</div>
          <div className="muted">{t("goalsHelp")}</div>
        </div>
        {/* add goal button removed: goals can be created from Quick Add */}
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
    </GlassCard>
  );
}
