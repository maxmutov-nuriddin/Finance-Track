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
      <div className="goals-list-header">
        <div className="goals-list-title">{t("allGoals")}</div>
        <div className="goals-count">{goals.length}</div>
      </div>

      {targetSavingsMode === "goal_based" && !activeGoalId && (
        <div className="alert" style={{ marginBottom: 20 }}>
          {t("chooseMainGoal")}
        </div>
      )}

      <div className="goals-items">
        {renderedGoals.map((goal) => (
          <div className={`goal-item ${goal.isActive ? "active" : ""} ${goal.isCompleted ? "completed" : ""}`} key={goal.id}>
            <div className="goal-item-header">
              <div className="goal-item-title">
                {goal.title}
                {goal.isCompleted && <span className="goal-badge-completed">✓ {t("goalCompleted")}</span>}
                {goal.isActive && !goal.isCompleted && <span className="goal-badge-active">⭐ {t("active")}</span>}
              </div>
              <div className="goal-item-progress-percent">{goal.progress}%</div>
            </div>

            <div className="goal-progress-bar">
              <div className="goal-progress-fill" style={{ width: `${goal.progress}%` }} />
            </div>

            <div className="goal-item-stats">
              <div className="goal-stat">
                <span className="goal-stat-label">{t("savedAmount")}</span>
                <span className="goal-stat-value">{formatAmount(goal.saved)}</span>
              </div>
              <div className="goal-stat">
                <span className="goal-stat-label">{t("remaining")}</span>
                <span className="goal-stat-value" style={{ color: goal.remaining > 0 ? "#ef4444" : "#22c55e" }}>
                  {formatAmount(goal.remaining)}
                </span>
              </div>
              <div className="goal-stat">
                <span className="goal-stat-label">{t("targetAmount")}</span>
                <span className="goal-stat-value">{formatAmount(goal.targetAmount)}</span>
              </div>
            </div>

            <div className="goal-item-hints">
              {goal.perMonth && <div className="goal-hint">📅 {goal.perMonth}</div>}
              {goal.perDay && <div className="goal-hint">⏱️ {goal.perDay}</div>}
              {goal.autoLabel && (
                <div className="goal-hint">
                  🎯 {goal.autoLabel}
                  {goal.autoHint && <div style={{ fontSize: "0.8rem", marginTop: 4 }}>{goal.autoHint}</div>}
                </div>
              )}
              {!goal.autoLabel && goal.forecast && <div className="goal-hint">📈 {goal.forecast}</div>}
            </div>

            <div className="goal-item-actions">
              {goal.canContribute && (
                <GlassButton onClick={() => onContribute?.(goal)} className="goal-action-btn">
                  {t("goalContribute", { amount: formatAmount(goal.contributionAmount) })}
                </GlassButton>
              )}
              {goal.canComplete && (
                <GlassButton onClick={() => onComplete?.(goal)} className="goal-action-btn">
                  {t("goalComplete")}
                </GlassButton>
              )}
              <GlassButton
                variant="ghost"
                onClick={() => onDelete(goal.id)}
                disabled={deletingIds?.has(goal.id)}
                className="goal-delete-btn"
              >
                ✕
              </GlassButton>
            </div>
          </div>
        ))}
        {!goals.length && (
          <div className="goals-empty">
            <div className="empty-icon">🎯</div>
            <div className="empty-text">{t("noGoals")}</div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
