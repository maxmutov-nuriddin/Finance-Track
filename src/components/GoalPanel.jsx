import { useMemo, useState } from "react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";
import ModalPortal from "./ModalPortal";

function formatShortDate(isoDate, lang) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export default function GoalPanel({
  goals,
  onDelete,
  onContribute,
  onWithdraw,
  onComplete,
  deletingIds,
  activeGoalId
}) {
  const { t, lang } = useI18n();
  const [editGoalId, setEditGoalId] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const closeEdit = () => {
    setEditGoalId("");
    setEditAmount("");
  };

  const handleWithdraw = (goal) => {
    const amount = Math.round(Number(editAmount || 0));
    if (!amount || amount <= 0) return;
    onWithdraw?.(goal, amount);
    closeEdit();
  };

  const renderedGoals = useMemo(
    () =>
      goals.map((goal) => {
        const title = goal.title || goal.name || goal.goalTitle || t("goalDefaultTitle");
        const saved = Number(
          goal.saved ?? goal.currentAmount ?? goal.savedAmount ?? 0
        );
        const targetAmount = Number(goal.targetAmount || 0);
        const remaining = Number.isFinite(goal.remaining)
          ? goal.remaining
          : Math.max(0, targetAmount - saved);
        const isCompleted = Boolean(goal.isCompleted || goal.completedAt) || remaining <= 0;
        const progress = Number.isFinite(goal.progress)
          ? goal.progress
          : targetAmount
            ? Math.min(100, Math.round((saved / targetAmount) * 100))
            : 0;
        const recommendedMonthly = Math.max(0, Math.round(Number(goal.recommendedMonthly || 0)));
        const monthsLeft = typeof goal.monthsLeft === "number" ? goal.monthsLeft : null;
        const forecastDate = goal.forecastDateISO ? formatShortDate(goal.forecastDateISO, lang) : "";
        const status = goal.status || (isCompleted ? "done" : recommendedMonthly > 0 ? "ok" : "paused");
        const statusLabel =
          status === "risk"
            ? t("goalStatusRisk")
            : status === "paused"
              ? t("goalStatusPaused")
              : t("goalStatusOk");
        const statusClass =
          status === "risk"
            ? "goal-badge-risk"
            : status === "paused"
              ? "goal-badge-paused"
              : "goal-badge-ok";
        const isActive = activeGoalId ? goal.id === activeGoalId : false;
        const canContribute = isActive && recommendedMonthly > 0 && !isCompleted;
        const canComplete = remaining <= 0 && !goal.isCompleted;
        const canWithdraw = saved > 0;
        const isEditing = editGoalId === goal.id;

        const hints = [];
        if (!isCompleted) {
          hints.push(t("goalRecommendedMonthly", { amount: formatAmount(recommendedMonthly) }));
          if (monthsLeft === null) {
            hints.push(t("goalForecastUnavailable"));
          } else if (monthsLeft > 0) {
            hints.push(t("goalMonthsLeft", { months: monthsLeft }));
            if (forecastDate) {
              hints.push(t("goalFinishDate", { date: forecastDate }));
            }
          }
        }

        return {
          ...goal,
          title,
          saved,
          targetAmount,
          remaining,
          isCompleted,
          progress,
          recommendedMonthly,
          monthsLeft,
          forecastDate,
          status,
          statusLabel,
          statusClass,
          isActive,
          canContribute,
          canComplete,
          canWithdraw,
          isEditing,
          hints
        };
      }),
    [goals, t, lang, activeGoalId, editGoalId]
  );

  const editingGoal = useMemo(
    () => renderedGoals.find((goal) => goal.id === editGoalId) || null,
    [renderedGoals, editGoalId]
  );

  return (
    <GlassCard>
      <div className="goals-list-header">
        <div className="goals-list-title">{t("allGoals")}</div>
        <div className="goals-count">{goals.length}</div>
      </div>

      <div className="goals-items">
        {renderedGoals.map((goal) => (
          <div className={`goal-item ${goal.isActive ? "active" : ""} ${goal.isCompleted ? "completed" : ""}`} key={goal.id}>
            <div className="goal-item-header">
              <div className="goal-item-title">
                <span className="goal-title-text">{goal.title}</span>
                {goal.isCompleted && (
                  <span className="goal-badge-completed">{t("goalCompleted")}</span>
                )}
                {!goal.isCompleted && (
                  <span className={goal.statusClass}>{goal.statusLabel}</span>
                )}
                {goal.isActive && !goal.isCompleted && (
                  <span className="goal-badge-active">{t("active")}</span>
                )}
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

            {goal.hints.length > 0 && (
              <div className="goal-item-hints">
                {goal.hints.map((hint, index) => (
                  <div className="goal-hint" key={`${goal.id}-hint-${index}`}>
                    {hint}
                  </div>
                ))}
              </div>
            )}

            <div className="goal-item-actions">
              {goal.canContribute && (
                <GlassButton onClick={() => onContribute?.(goal)} className="goal-action-btn">
                  {t("goalContribute", { amount: formatAmount(goal.recommendedMonthly) })}
                </GlassButton>
              )}
              {goal.canWithdraw && (
                <GlassButton
                  variant="ghost"
                  onClick={() => {
                    setEditGoalId(goal.id);
                    setEditAmount("");
                  }}
                  className="goal-edit-btn"
                >
                  {t("goalEdit")}
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
                x
              </GlassButton>
            </div>

          </div>
        ))}
        {!goals.length && (
          <div className="goals-empty">
            <div className="empty-icon">-</div>
            <div className="empty-text">{t("noGoals")}</div>
          </div>
        )}
      </div>

      {editingGoal && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={closeEdit}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>{t("goalEdit")}</strong>
                  <div className="modal-hint">{editingGoal.title}</div>
                </div>
                <GlassButton variant="ghost" onClick={closeEdit}>
                  {t("close")}
                </GlassButton>
              </div>
              <div className="modal-body">
                <div className="modal-card">
                  <div className="modal-label">{t("amount")}</div>
                  <input
                    className="glass-input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder={t("amount")}
                    value={editAmount}
                    onChange={(event) => setEditAmount(event.target.value)}
                  />
                  <div className="helper-text">
                    {t("savedAmount")}: {formatAmount(editingGoal.saved)}
                  </div>
                </div>
                <div className="modal-footer">
                  <GlassButton onClick={() => handleWithdraw(editingGoal)}>
                    {t("goalWithdraw")}
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={closeEdit}>
                    {t("close")}
                  </GlassButton>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </GlassCard>
  );
}


