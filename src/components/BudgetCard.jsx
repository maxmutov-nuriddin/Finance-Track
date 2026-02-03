import React from "react";
import GlassCard from "./GlassCard";
import GlassButton from "./GlassButton";
import { computeBudgetProgress } from "../lib/budget";
import { formatAmount } from "../lib/format";
import { useI18n } from "./I18nProvider";

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
  const { t } = useI18n();
  const { progress, overspent } = computeBudgetProgress(
    currentMonthExpense,
    recommendedMaxSpend
  );
  const remaining = Math.max(0, Math.round(recommendedMaxSpend - currentMonthExpense));
  const warningText = warning
    ? warning === "Добавь доход (зп), чтобы мы рассчитали бюджет."
      ? t("budgetWarnNoIncome")
      : warning === "Не удалось рассчитать бюджет. Проверь данные."
        ? t("budgetWarnInvalid")
        : warning ===
          "С текущим доходом и обязательными платежами цель в выбранный срок недостижима."
          ? t("budgetWarnNegative")
          : warning
    : "";

  return (
    <GlassCard>
      <div className="footer-row">
        <div>
          <div className="card-title">{t("budgetTitle")}</div>
          <div className="helper-text">{t("budgetHelper")}</div>
        </div>
        <GlassButton variant="secondary" onClick={onOpenSettings}>
          {t("configure")}
        </GlassButton>
      </div>

      {warningText ? (
        <div className="alert alert-danger" style={{ marginTop: 12 }}>
          {warningText}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="hero-amount">
            {formatAmount(remaining)}
          </div>
          <div className="helper-text">{t("remainingSpendLabel")}</div>
          <div style={{ marginTop: 12 }}>
            <div
              className="progress-wrap"
              style={{ marginBottom: 6 }}
              data-tooltip={`${t("spentLabel")}: ${formatAmount(Math.round(currentMonthExpense))} / ${formatAmount(Math.round(recommendedMaxSpend))}`}
            >
              <div className="progress">
                <span
                  style={{
                    width: `${progress}%`,
                    background: overspent
                      ? "linear-gradient(90deg, #ff6a85, #ff9d6c)"
                      : undefined
                  }}
                />
              </div>
            </div>
            <div className="muted">
              {t("spentLabel")}: {formatAmount(Math.round(currentMonthExpense))} / {formatAmount(Math.round(recommendedMaxSpend))}
              {overspent ? " • " + t("overspent") : ""}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {t("limitMonth")}: {formatAmount(Math.round(recommendedMaxSpend))}
            </div>
          </div>
        </div>
      )}

      <div className="plan-summary">
        <div className="plan-item">
          <span className="muted">{t("income")}</span>
          <span className="stat-value">{formatAmount(Math.round(monthlyIncome))}</span>
        </div>
        <div className="plan-item">
          <span className="muted">{t("mandatory")}</span>
          <span className="stat-value">{formatAmount(Math.round(monthlyMandatory))}</span>
        </div>
        <div className="plan-item">
          <span className="muted">{t("canSpend")}</span>
          <span className="stat-value">{formatAmount(Math.round(planSpend))}</span>
        </div>
      </div>

      {budgetMode === "manual" && (
        <div className="helper-text" style={{ marginTop: 8 }}>
          {t("limitMonth")}: {formatAmount(Math.round(recommendedMaxSpend))}
        </div>
      )}
    </GlassCard>
  );
}
