import React from "react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { computeBudgetProgress } from "../lib/budget";
import { formatAmount } from "../lib/format";

export default function BudgetCard({
  monthlyIncome,
  monthlyMandatory,
  recommendedMaxSpend,
  currentMonthExpense,
  budgetMode,
  planSpend,
  warning,
  onOpenSettings
}) {
  const { progress, overspent } = computeBudgetProgress(
    currentMonthExpense,
    recommendedMaxSpend
  );

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">Сколько можно тратить в месяц</div>
          <div className="helper-text">Чтобы платить обязательное и идти к цели.</div>
        </div>
        <GlassButton variant="secondary" onClick={onOpenSettings}>
          Настроить
        </GlassButton>
      </div>

      {warning ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          {warning}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="hero-amount">
            ≈ {formatAmount(Math.round(recommendedMaxSpend))}
          </div>
          <div className="helper-text">Лимит трат на месяц.</div>
          <div style={{ marginTop: 12 }}>
            <div className="progress" style={{ marginBottom: 6 }}>
              <span
                style={{
                  width: `${progress}%`,
                  background: overspent
                    ? "linear-gradient(90deg, #ff6a85, #ff9d6c)"
                    : undefined
                }}
              />
            </div>
            <div className="muted">
              Потрачено: {formatAmount(Math.round(currentMonthExpense))} / {formatAmount(Math.round(recommendedMaxSpend))}
              {overspent ? " • перерасход" : ""}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Осталось: {formatAmount(Math.max(0, Math.round(recommendedMaxSpend - currentMonthExpense)))}
            </div>
          </div>
        </div>
      )}

      <div className="plan-summary">
        <div className="plan-item">
          <span className="muted">Доход</span>
          <span className="stat-value">{formatAmount(Math.round(monthlyIncome))}</span>
        </div>
        <div className="plan-item">
          <span className="muted">Обязательные</span>
          <span className="stat-value">{formatAmount(Math.round(monthlyMandatory))}</span>
        </div>
        <div className="plan-item">
          <span className="muted">Можно тратить</span>
          <span className="stat-value">{formatAmount(Math.round(planSpend))}</span>
        </div>
      </div>

      {budgetMode === "manual" && (
        <div className="helper-text" style={{ marginTop: 8 }}>
          Ручной лимит трат: {formatAmount(Math.round(recommendedMaxSpend))}
        </div>
      )}
    </GlassCard>
  );
}
